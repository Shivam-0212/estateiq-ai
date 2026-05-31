from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import pickle, json, numpy as np, math
import google.generativeai as genai
from services.api_integrations import ZillowAPI, WalkScoreAPI, FinancialAPI, OpenAIAgent

# ── Constants ─────────────────────────────────────────────────────────
SALE_YEAR    = 2014  # Matches dataset timeframe to prevent age skew
RENT_YIELD   = 0.006   # 0.6% of property value per month (gross estimate)
MARKET_APPRECIATION = 1.95  # Adjusts 2014 prices to current market levels

# ── Globals ───────────────────────────────────────────────────────────
model = label_encoder = zip_encoder = None
city_stats = zip_stats = city_zip_map = {}
features = cities = []
model_metrics = market_stats = {}


# ── Lifespan (replaces deprecated @app.on_event) ──────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, label_encoder, zip_encoder
    global city_stats, zip_stats, city_zip_map
    global features, cities, model_metrics, market_stats

    with open("model.pkl",         "rb") as f: model          = pickle.load(f)
    with open("label_encoder.pkl", "rb") as f: label_encoder  = pickle.load(f)
    with open("zip_encoder.pkl",   "rb") as f: zip_encoder    = pickle.load(f)
    with open("city_stats.json")         as f: city_stats      = json.load(f)
    with open("zip_stats.json")          as f: zip_stats       = json.load(f)
    with open("city_zip_map.json")       as f: city_zip_map    = json.load(f)
    with open("features.json")           as f: features        = json.load(f)
    with open("cities.json")             as f: cities          = json.load(f)
    with open("model_metrics.json")      as f: model_metrics   = json.load(f)
    with open("market_stats.json")       as f: market_stats    = json.load(f)

    print(f"✅ Model loaded | R²={model_metrics.get('r2')} | Features={len(features)}")
    yield
    # shutdown — nothing to clean up


# ── App ───────────────────────────────────────────────────────────────
app = FastAPI(title="EstateIQ — AI Real Estate Investment Analyzer", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ───────────────────────────────────────────────────────────
class PropertyInput(BaseModel):
    bedrooms:      float
    bathrooms:     float
    sqft_living:   int
    sqft_lot:      int
    floors:        float         = 1.0
    waterfront:    int           = 0
    view:          int           = 0
    condition:     int           = 3
    sqft_above:    int
    sqft_basement: int           = 0
    yr_built:      int           = 1990
    yr_renovated:  int           = 0
    city:          str
    zipcode:       Optional[int] = None
    sale_month:    int           = 6
    asking_price:  Optional[float] = None
    address:       Optional[str] = None

class ChatInput(BaseModel):
    message: str
    context: dict
    api_key: str


# ── Routes ────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status":    "ok",
        "app":       "EstateIQ",
        "model_r2":  model_metrics.get("r2"),
        "features":  len(features),
    }


@app.get("/health")
def health():
    return {
        "status":       "healthy",
        "model_loaded": model is not None,
        "cities":       len(cities),
    }


@app.get("/cities")
def get_cities():
    return {"cities": sorted(cities)}


@app.get("/city-zips/{city_name}")
def get_city_zips(city_name: str):
    zips = city_zip_map.get(city_name, [])
    if not zips:
        raise HTTPException(404, f"No ZIP codes found for '{city_name}'")
    return {"city": city_name, "zipcodes": zips}


@app.get("/market-overview")
def market_overview():
    return {
        "market_stats":  market_stats,
        "model_metrics": model_metrics,
    }


@app.get("/city-stats/{city_name}")
def get_city_stats(city_name: str):
    if city_name in city_stats:
        return city_stats[city_name]
    raise HTTPException(404, f"City '{city_name}' not found")


@app.post("/enrich-property")
def enrich_property(payload: dict):
    address = payload.get("address")
    if not address:
        raise HTTPException(400, "Address is required")
    return ZillowAPI.fetch_property_data(address)


@app.post("/analyze")
def analyze(data: PropertyInput):
    try:
        # ── Validate city ──────────────────────────────────────────
        if data.city not in city_stats:
            raise HTTPException(400, f"Unknown city: '{data.city}'. Call /cities for the full list.")

        # ── Feature engineering (must mirror training exactly) ─────
        house_age        = SALE_YEAR - data.yr_built
        renovated        = 1 if data.yr_renovated > 0 else 0
        years_since_reno = (SALE_YEAR - data.yr_renovated) if renovated else house_age
        basement_present = 1 if data.sqft_basement > 0 else 0
        total_rooms      = data.bedrooms + data.bathrooms
        sqft_ratio       = data.sqft_living / max(data.sqft_lot, 1)
        bed_bath_ratio   = data.bedrooms    / max(data.bathrooms, 1)
        sqft_living_log  = np.log1p(data.sqft_living)
        sqft_lot_log     = np.log1p(data.sqft_lot)
        sqft_x_condition = data.sqft_living * data.condition
        sqft_x_view      = data.sqft_living * (data.view + 1)
        age_x_condition  = house_age * data.condition
        waterfront_x_view = data.waterfront * (data.view + 1)
        bath_per_bed     = data.bathrooms   / max(data.bedrooms, 1)
        sqft_per_room    = data.sqft_living / max(total_rooms, 1)
        basement_ratio   = data.sqft_basement / max(data.sqft_living, 1)

        # ── City stats ─────────────────────────────────────────────
        cs             = city_stats.get(data.city, {})
        city_avg_price = cs.get("city_avg_price",   market_stats["overall_avg_price"])
        city_avg_ppsf  = cs.get("city_avg_ppsf",    market_stats["overall_avg_ppsf"])
        city_median    = cs.get("city_median_price", city_avg_price)
        city_count     = cs.get("city_count",        100)

        try:    city_encoded = int(label_encoder.transform([data.city])[0])
        except: city_encoded = 0

        # ── ZIP stats ──────────────────────────────────────────────
        zip_key = str(int(data.zipcode)) if data.zipcode else None
        zs      = zip_stats.get(zip_key, {}) if zip_key else {}

        zip_avg_price    = zs.get("zip_avg_price",    city_avg_price)
        zip_avg_ppsf     = zs.get("zip_avg_ppsf",     city_avg_ppsf)
        zip_median_price = zs.get("zip_median_price",  city_median)
        zip_count        = zs.get("zip_count",         city_count)

        try:    zip_encoded = int(zip_encoder.transform([zip_key or "0"])[0])
        except: zip_encoded = 0

        # ── Feature vector (same order as training) ────────────────
        feat_values = [
            data.bedrooms,    data.bathrooms,  data.sqft_living, data.sqft_lot,
            data.floors,      data.waterfront, data.view,        data.condition,
            data.sqft_above,  data.sqft_basement,
            house_age,        renovated,       years_since_reno,
            sqft_living_log,  sqft_lot_log,
            sqft_x_condition, sqft_x_view,     age_x_condition,
            waterfront_x_view,bath_per_bed,    sqft_per_room,
            basement_ratio,   basement_present,
            total_rooms,      bed_bath_ratio,  sqft_ratio,
            zip_encoded,      zip_avg_price,   zip_avg_ppsf,
            zip_median_price, zip_count,
            city_encoded,     city_avg_price,  city_avg_ppsf,   city_count,
            data.sale_month,  SALE_YEAR,
        ]

        # ── Predict ────────────────────────────────────────────────
        X           = np.array(feat_values).reshape(1, -1)
        log_pred    = float(model.predict(X)[0])
        pred_price  = math.expm1(log_pred)
        
        # ── Adjust to Current Market Values ────────────────────────
        pred_price      *= MARKET_APPRECIATION
        city_avg_price  *= MARKET_APPRECIATION
        city_median     *= MARKET_APPRECIATION
        city_avg_ppsf   *= MARKET_APPRECIATION
        zip_avg_price   *= MARKET_APPRECIATION
        zip_avg_ppsf    *= MARKET_APPRECIATION
        zip_median_price*= MARKET_APPRECIATION

        ppsf        = pred_price / max(data.sqft_living, 1)

        # ── Investment scoring ─────────────────────────────────────
        score_result = compute_investment_score(
            data        = data,
            pred_price  = pred_price,
            city_avg    = city_avg_price,
            city_median = city_median,
            ppsf        = ppsf,
            city_ppsf   = city_avg_ppsf,
            house_age   = house_age,
            renovated   = renovated,
            zip_avg_price = zip_avg_price,
            zip_avg_ppsf  = zip_avg_ppsf,
        )

        # ── Walk Score & Financial APIs ────────────────────────────
        walk_data = WalkScoreAPI.get_score(data.address) if data.address else None
        mortgage_rate = FinancialAPI.get_current_mortgage_rate()
        
        # Simple mortgage calculation (20% down, 30-year fixed)
        principal = pred_price * 0.8
        monthly_rate = (mortgage_rate / 100) / 12
        num_payments = 30 * 12
        if monthly_rate > 0:
            monthly_mortgage = principal * (monthly_rate * (1 + monthly_rate)**num_payments) / ((1 + monthly_rate)**num_payments - 1)
        else:
            monthly_mortgage = principal / num_payments

        # Real cash flow estimate
        monthly_rent = pred_price * RENT_YIELD
        monthly_cash_flow = monthly_rent - monthly_mortgage
        annual_roi   = (monthly_cash_flow * 12) / (pred_price * 0.2) * 100 if pred_price > 0 else 0

        # ── AI Summary ─────────────────────────────────────────────
        ai_summary = OpenAIAgent.generate_report(
            data={"bedrooms": data.bedrooms, "bathrooms": data.bathrooms, "city": data.city, "yr_built": data.yr_built},
            predicted_price=pred_price,
            score=score_result["score"],
            insights=score_result["insights"],
            annual_roi=annual_roi,
            recommendation=score_result["recommendation"]
        )

        # ── Build response ─────────────────────────────────────────
        result = {
            # Prediction
            "predicted_price":       round(pred_price,   2),
            "price_per_sqft":        round(ppsf,         2),
            # City benchmarks
            "city_avg_price":        round(city_avg_price, 2),
            "city_median_price":     round(city_median,    2),
            "city_avg_ppsf":         round(city_avg_ppsf,  2),
            # ZIP benchmarks
            "zip_avg_price":         round(zip_avg_price,  2),
            "zip_avg_ppsf":          round(zip_avg_ppsf,   2),
            # Property facts
            "house_age":             house_age,
            # External API Data
            "walk_score":            walk_data["walk_score"] if walk_data else None,
            "transit_score":         walk_data["transit_score"] if walk_data else None,
            "mortgage_rate":         mortgage_rate,
            "ai_summary":            ai_summary,
            # Investment scoring
            "investment_score":      score_result["score"],
            "investment_grade":      score_result["grade"],
            "investment_label":      score_result["label"],
            "risk_level":            score_result["risk_level"],
            "recommendation":        score_result["recommendation"],
            "insights":              score_result["insights"],
            # Financials
            "monthly_rent_estimate": round(monthly_rent, 2),
            "monthly_mortgage":      round(monthly_mortgage, 2),
            "monthly_cash_flow":     round(monthly_cash_flow, 2),
            "annual_roi_estimate":   round(annual_roi,   2),
        }

        # ── Deal analysis (optional) ───────────────────────────────
        if data.asking_price:
            diff     = pred_price - data.asking_price
            diff_pct = (diff / data.asking_price) * 100
            result.update({
                "asking_price":         round(data.asking_price, 2),
                "price_difference":     round(diff,     2),
                "price_difference_pct": round(diff_pct, 2),
                "deal_status": (
                    "Undervalued" if diff >  5000 else
                    "Overvalued"  if diff < -5000 else
                    "Fair Value"
                ),
            })

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Prediction error: {str(e)}")


# ── Investment scoring logic ──────────────────────────────────────────
def compute_investment_score(
    data, pred_price, city_avg, city_median,
    ppsf, city_ppsf, house_age, renovated,
    zip_avg_price, zip_avg_ppsf
):
    score    = 50
    insights = []

    # ── Waterfront & View ──────────────────────────────────────────
    if data.waterfront:
        score += 12
        insights.append({"type": "positive", "text": "Waterfront property — premium location with high demand"})

    if data.view >= 4:
        score += 10
        insights.append({"type": "positive", "text": "Exceptional view — significant value premium"})
    elif data.view >= 2:
        score += 5
        insights.append({"type": "positive", "text": "Good view — adds desirability and resale value"})
    elif data.view == 0 and not data.waterfront:
        insights.append({"type": "neutral", "text": "No view premium — standard street-level property"})

    # ── Condition ─────────────────────────────────────────────────
    if data.condition == 5:
        score += 10
        insights.append({"type": "positive", "text": "Excellent condition — move-in ready, no capex needed"})
    elif data.condition == 4:
        score += 5
        insights.append({"type": "positive", "text": "Good condition — only minor touch-ups needed"})
    elif data.condition == 3:
        insights.append({"type": "neutral", "text": "Average condition — standard maintenance expected"})
    elif data.condition == 2:
        score -= 8
        insights.append({"type": "negative", "text": "Fair condition — budget for moderate renovation costs"})
    else:
        score -= 14
        insights.append({"type": "negative", "text": "Poor condition — significant renovation costs expected"})

    # ── Age & Renovation ──────────────────────────────────────────
    if house_age < 10:
        score += 8
        insights.append({"type": "positive", "text": f"Modern build ({SALE_YEAR - house_age}) — low maintenance, high buyer appeal"})
    elif house_age < 25:
        score += 4
        insights.append({"type": "positive", "text": "Relatively new — good structural integrity expected"})
    elif house_age > 60 and not renovated:
        score -= 10
        insights.append({"type": "negative", "text": "Older property, never renovated — potential hidden costs"})
    elif house_age > 40 and not renovated:
        score -= 4
        insights.append({"type": "negative", "text": "Aging property without renovation — systems may need updating"})

    if renovated:
        score += 6
        insights.append({"type": "positive", "text": "Renovated — updated systems and finishes extend useful life"})

    # ── ZIP-level value comparison ─────────────────────────────────
    if zip_avg_ppsf > 0:
        ppsf_vs_zip = (ppsf - zip_avg_ppsf) / zip_avg_ppsf * 100
        if ppsf < zip_avg_ppsf * 0.88:
            score += 10
            insights.append({"type": "positive", "text": f"Price/sqft (${ppsf:.0f}) is {abs(ppsf_vs_zip):.0f}% below ZIP avg (${zip_avg_ppsf:.0f}) — great value"})
        elif ppsf < zip_avg_ppsf * 0.95:
            score += 5
            insights.append({"type": "positive", "text": f"Price/sqft slightly below ZIP avg (${zip_avg_ppsf:.0f}) — good neighbourhood value"})
        elif ppsf > zip_avg_ppsf * 1.15:
            score -= 6
            insights.append({"type": "negative", "text": f"Price/sqft (${ppsf:.0f}) is {ppsf_vs_zip:.0f}% above ZIP avg (${zip_avg_ppsf:.0f}) — premium priced"})
        else:
            insights.append({"type": "neutral", "text": f"Price/sqft (${ppsf:.0f}) is in line with ZIP average (${zip_avg_ppsf:.0f})"})

    # ── City-level price position ──────────────────────────────────
    if city_median > 0:
        if pred_price < city_median * 0.85:
            score += 6
            insights.append({"type": "positive", "text": "Well below city median — strong long-term appreciation potential"})
        elif pred_price < city_median:
            score += 3
            insights.append({"type": "positive", "text": "Below city median — room for price growth over time"})
        elif pred_price > city_median * 1.3:
            score -= 4
            insights.append({"type": "negative", "text": "Significantly above city median — limited upside headroom"})

    # ── Rental & size bonuses ──────────────────────────────────────
    if data.sqft_basement > 400:
        score += 5
        insights.append({"type": "positive", "text": f"Large basement ({data.sqft_basement} sqft) — ADU or rental suite potential"})
    elif data.sqft_basement > 0:
        score += 2
        insights.append({"type": "positive", "text": "Basement adds storage or flexible living space"})

    if data.bedrooms >= 4:
        score += 3
        insights.append({"type": "positive", "text": f"{data.bedrooms:.0f} bedrooms — strong family rental demand"})

    if data.sqft_living >= 2500:
        score += 3
        insights.append({"type": "positive", "text": f"Large home ({data.sqft_living:,} sqft) — appeals to premium buyer segment"})

    # ── Red flag: high price, no premium features ──────────────────
    if data.waterfront == 0 and data.view == 0 and pred_price > city_avg * 1.2:
        score -= 5
        insights.append({"type": "negative", "text": "High price without premium features — limited fundamental value drivers"})

    # ── Clamp & grade ──────────────────────────────────────────────
    score = max(0, min(100, score))

    if score >= 80:
        grade, label, risk = "A", "Excellent Investment", "Low"
        rec = "🟢 Strong Buy — Multiple high-value indicators align. Excellent long-term ROI potential with low risk."
    elif score >= 65:
        grade, label, risk = "B", "Good Investment", "Low-Medium"
        rec = "🟢 Buy — Solid fundamentals with good appreciation expected. Minor considerations to review."
    elif score >= 50:
        grade, label, risk = "C", "Moderate Investment", "Medium"
        rec = "🟡 Consider — Decent investment opportunity. Negotiate price and conduct thorough inspection."
    elif score >= 35:
        grade, label, risk = "D", "Below Average", "High"
        rec = "🟠 Caution — Notable risk factors present. Requires significant discount to justify purchase."
    else:
        grade, label, risk = "F", "Poor Investment", "Very High"
        rec = "🔴 Avoid — Multiple red flags identified. Not recommended at current price point."

    return {
        "score":       score,
        "grade":       grade,
        "label":       label,
        "risk_level":  risk,
        "recommendation": rec,
        "insights":    insights,
    }


# ── Real Estate AI Chatbot ──────────────────────────────────────────
import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

@app.post("/chat")
def chat_with_gemini(data: ChatInput):
    api_key = data.api_key if data.api_key and data.api_key != "backend_env" else os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API Key is required. Please set GEMINI_API_KEY in your backend .env file.")
    try:
        prompt = f"""You are an expert AI Real Estate Advisor assisting a user with their property investment analysis. 
You are given the following context from our internal machine learning model:

PROPERTY CONTEXT & PREDICTION:
{json.dumps(data.context, indent=2)}

USER QUESTION:
{data.message}

INSTRUCTIONS:
1. Provide a highly professional, concise, and structured answer.
2. Answer specifically based on the context provided.
3. ALWAYS format your response beautifully using Markdown. Use bolding (**text**) for key metrics, bullet points for lists, and brief paragraphs to make it highly readable.
4. Keep the tone friendly, expert, and encouraging.
5. Do not hallucinate or make up property details not in the context.
"""
        
        import requests
        
        models_to_try = [
            "gemini-flash-latest",
            "gemini-pro-latest",
            "gemini-2.5-flash",
            "gemini-2.5-pro"
        ]
        
        last_error = "Unknown Error"
        for model_name in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            
            try:
                resp = requests.post(url, json=payload)
                resp_data = resp.json()
                
                if resp.status_code == 200:
                    reply_text = resp_data["candidates"][0]["content"]["parts"][0]["text"]
                    return {"reply": reply_text}
                else:
                    err_msg = resp_data.get("error", {}).get("message", f"HTTP {resp.status_code}")
                    last_error = err_msg
                    # If it's a high demand error, try the next model. If it's an auth error, we shouldn't retry, but retrying is harmless enough.
                    print(f"Model {model_name} failed: {err_msg}")
                    continue
            except Exception as inner_e:
                last_error = str(inner_e)
                continue
                
        raise Exception(f"All models failed. Last error: {last_error}")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))