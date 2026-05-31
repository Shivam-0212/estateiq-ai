import hashlib
import random
import os

class ZillowAPI:
    """Simulated Zillow API for fetching property details."""
    @staticmethod
    def fetch_property_data(address: str):
        # Use deterministic hash to return consistent data for the same address
        h = int(hashlib.sha256(address.encode()).hexdigest(), 16)
        
        # Determine city and zip if they were part of the address string heuristically
        city = "Seattle"
        zipcode = 98103
        if "Bellevue" in address: city, zipcode = "Bellevue", 98004
        if "Redmond" in address: city, zipcode = "Redmond", 98052
        if "Kirkland" in address: city, zipcode = "Kirkland", 98033

        bedrooms = 2 + (h % 4)
        bathrooms = max(1, bedrooms - 1 + (h % 3) * 0.5)
        sqft_living = 800 + (h % 2500)
        sqft_lot = sqft_living + (h % 4000)
        yr_built = 1950 + (h % 70)
        
        return {
            "city": city,
            "zipcode": zipcode,
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "sqft_living": sqft_living,
            "sqft_lot": sqft_lot,
            "yr_built": yr_built,
            "waterfront": 1 if (h % 100) > 95 else 0,
            "view": h % 5,
            "condition": 3 + (h % 3),
            "sqft_above": sqft_living,
            "sqft_basement": 0,
            "floors": 1 + (h % 2)
        }

class WalkScoreAPI:
    """Simulated Walk Score API."""
    @staticmethod
    def get_score(address: str):
        h = int(hashlib.sha256(address.encode()).hexdigest(), 16)
        walk_score = 40 + (h % 55)
        return {
            "walk_score": walk_score,
            "transit_score": max(20, walk_score - 15 + (h % 20)),
            "description": "Walker's Paradise" if walk_score > 90 else "Very Walkable" if walk_score > 70 else "Somewhat Walkable"
        }

class FinancialAPI:
    """Simulated FRED/Bankrate API for live mortgage rates."""
    @staticmethod
    def get_current_mortgage_rate():
        # In a real app, this makes a request to FRED API
        # Returning a realistic current rate
        return 6.85

class OpenAIAgent:
    """Simulated OpenAI API for natural language insights."""
    @staticmethod
    def generate_report(data: dict, predicted_price: float, score: int, insights: list = None, annual_roi: float = 0, recommendation: str = ""):
        # Check if real API key exists
        api_key = os.getenv("OPENAI_API_KEY")
        
        if not insights:
            insights = []
            
        strengths = [ins["text"] for ins in insights if ins["type"] == "positive"]
        risks = [ins["text"] for ins in insights if ins["type"] == "negative"]
        
        qualifier = "an exceptional" if score >= 80 else "a solid" if score >= 65 else "a moderate" if score >= 50 else "a risky"
        roi_text = f" It offers an estimated cash-on-cash ROI of {annual_roi:.1f}%." if annual_roi else ""
        
        summary = (
            f"Based on local market algorithms, this {int(data['bedrooms'])}bd/{int(data['bathrooms'])}ba "
            f"property in {data['city']} represents {qualifier} investment opportunity at a predicted valuation "
            f"of ${predicted_price:,.0f}.{roi_text} The property's condition and year built ({data['yr_built']}) "
            f"have been factored into this assessment."
        )
        
        return {
            "summary": summary,
            "strengths": strengths if strengths else ["Property meets standard baseline expectations."],
            "risks": risks if risks else ["No major negative indicators detected by the model."],
            "verdict": recommendation or "Neutral - proceed with standard due diligence."
        }
