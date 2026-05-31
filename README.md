# EstateIQ: AI-Powered Real Estate Investment Analyzer

## 1. Project Overview

**EstateIQ** is a comprehensive, end-to-end Machine Learning web application designed to help users evaluate real estate properties. 

**Purpose:** To provide instant, data-driven property valuations and generate comprehensive investment scorecards based on property characteristics and local market conditions.
**Problem Solved:** Real estate investors and homebuyers often rely on slow, manual comparable analysis ("comps") or gut feeling to determine if a property is priced fairly. EstateIQ automates this process, providing instant valuations, ROI estimates, and risk analysis.
**Target Users:** Real estate investors, potential homebuyers, wholesalers, and real estate agents looking for quick, quantitative deal analysis.

---

## 2. Tech Stack Detection

The project is built using a modern, decoupled architecture:

### Frontend
* **Framework:** **React** (bootstrapped with **Vite** for incredibly fast hot-module replacement and optimized builds).
* **Styling:** **Vanilla CSS** (custom design system focused on high-performance, tailored aesthetics without utility-class bloat).
* **HTTP Client:** **Axios** for seamless, promise-based REST API communication.
* **Data Visualization:** **Recharts** for rendering responsive, interactive market comparison charts.

### Backend
* **Framework:** **FastAPI** (Python). Chosen for its extreme speed, asynchronous capabilities, and automatic interactive API documentation (Swagger UI).
* **Machine Learning:** **XGBoost** (`XGBRegressor`). A state-of-the-art gradient boosting library, chosen because it consistently outperforms deep learning on structured, tabular data (like real estate features) and handles non-linear relationships gracefully.
* **Data Processing:** **Pandas** and **NumPy** for data cleaning, aggregation, and mathematical transformations (e.g., logarithmic scaling).
* **Preprocessing Pipeline:** **Scikit-Learn** (`LabelEncoder`, `train_test_split`, and metrics). 

### Data Storage & Artifacts
* **Serialization:** **Pickle (`.pkl`)** for storing trained models and encoders.
* **In-Memory Configs:** **JSON**. Geographical aggregations (city/ZIP stats) are pre-computed and stored as JSON. This avoids the overhead of a SQL database, allowing the API to achieve sub-millisecond data retrieval.

---

## 3. Folder & Architecture Breakdown

```text
ai-real-estate/
├── backend/                  # Python/FastAPI Machine Learning Server
│   ├── main.py               # The FastAPI application and inference engine
│   ├── train.py              # The ML training pipeline and feature engineering script
│   ├── test_split.py         # Utility for managing train/test dataset splits
│   ├── data.csv              # The historical real estate dataset
│   ├── model.pkl             # Serialized XGBoost Regressor model
│   ├── label_encoder.pkl     # Encodes city strings to integer categories
│   ├── zip_encoder.pkl       # Encodes ZIP codes to integer categories
│   └── *.json                # Pre-computed market stats, metrics, and feature lists
│
└── frontend/                 # React SPA (Single Page Application)
    ├── src/
    │   ├── App.jsx           # Main application logic and multi-step form state
    │   ├── main.jsx          # React entry point
    │   ├── App.css           # Component-level styles
    │   └── index.css         # Global variables and resets
    ├── package.json          # Node dependencies
    └── vite.config.js        # Vite bundler configuration
```

### Architectural Flow
The system uses a **Client-Server Architecture**. The React frontend serves as the presentation layer, maintaining user state. It communicates via HTTP POST to the FastAPI backend, which acts as the application and logic layer. The backend loads the pre-trained XGBoost model and pre-computed statistical JSON files into memory at startup (via FastAPI's `lifespan`), ensuring highly performant, stateless predictions.

---

## 4. Backend Deep Explanation

The backend (`main.py`) acts as the brain of the application. 

### API Endpoints
* `GET /cities` & `GET /city-zips/{city_name}`: Lookups for the frontend dropdowns.
* `GET /market-overview` & `/city-stats/{city_name}`: Exposes pre-computed market data.
* `POST /analyze`: The core inference endpoint. Accepts a `PropertyInput` payload and returns a comprehensive JSON analysis report.

### Request Flow
1. **Input Reception:** The frontend sends property details (beds, baths, sqft, city, etc.) to `/analyze`.
2. **Validation:** Pydantic strictly types and validates the incoming data.
3. **Feature Engineering:** The backend precisely reconstructs the features used during training. It calculates `house_age`, logarithmic transforms (`sqft_living_log`), interaction terms (`sqft_x_condition`), and geographical averages by querying the loaded JSON dictionaries.
4. **Encoding:** Text data (City, ZIP) is safely converted to integers using the loaded Scikit-Learn `.pkl` encoders.
5. **Prediction:** The 37-dimensional feature array is passed to the XGBoost model. The model predicts the *logarithm* of the price.
6. **Post-Processing:** The `math.expm1()` function reverses the logarithm to output the final raw dollar value.
7. **Rule-Based Scoring:** The predicted price is passed into the `compute_investment_score()` function alongside market baselines to generate an investment grade.
8. **Response:** A massive JSON object containing the prediction, insights, and financial projections is returned to the frontend.

---

## 5. Machine Learning Pipeline

The training logic is housed in `train.py`.

* **Dataset:** Real estate data filtered to remove invalid properties (price <= 0). The target variable is `price`.
* **Preprocessing:** The target variable is right-skewed (a few very expensive homes pull the average up). To normalize this, the pipeline applies `np.log1p()` to the price before training, making the model more accurate across standard homes.
* **Feature Engineering:** Creates 37 distinct features. Notable engineered features include:
  * `years_since_reno`: Accounts for property aging vs. recent updates.
  * *Interaction Terms*: `sqft_x_condition`, `waterfront_x_view` (helps the model understand that a large house in poor condition is valued differently than a small house in poor condition).
  * *Target Encoding approximations*: Averages for `zip_avg_price` and `city_avg_ppsf` are mapped back to individual rows.
* **Model:** `XGBRegressor` with heavily tuned hyperparameters (e.g., `learning_rate=0.04`, `max_depth=6`, `subsample=0.85`) to prevent overfitting.
* **Evaluation Metrics:**
  * **R² (0.8244):** The model successfully explains ~82.4% of the variance in housing prices. A very strong score for tabular real estate data.
  * **MAPE (16.1%):** On average, the model's price prediction is within 16.1% of the actual sold price.
  * **MAE ($82,906):** The absolute dollar error on average.
  * **RMSE ($149,789):** Punishes large outlier errors, hence it is higher than MAE.

---

## 6. Deal Analysis Logic

While XGBoost predicts the *Fair Market Value*, the `compute_investment_score` function acts as a heuristic expert system to evaluate the deal:

1. **Valuation (Undervalued vs. Overvalued):** If the User inputs an *Asking Price*, the system subtracts it from the *Predicted Price*. If the prediction is >$5,000 higher than the asking price, it is labeled **Undervalued** (a good deal).
2. **ROI & Rent:** Calculates monthly rent using a flat 0.6% rule (`RENT_YIELD = 0.006`). Annual ROI is derived from this estimated gross rental income.
3. **Investment Score (0 to 100):**
   * Starts at a baseline of 50.
   * **Location/Feature Multipliers:** +12 for waterfront, up to +10 for views.
   * **Condition:** +10 for excellent condition; severe penalties (-14) for poor condition due to expected CAPEX (capital expenditures).
   * **Value Comparisons:** Heavily rewards properties where the calculated Price per Square Foot (PPSF) is significantly lower than the ZIP code average.
4. **Grading Tier:** The numerical score dictates the letter grade: A (>=80), B (>=65), C (>=50), D (>=35), F (<35).

---

## 7. Frontend Explanation

The frontend is a dynamic, state-driven React application.

* **App.jsx:** Manages a sophisticated multi-step wizard. Instead of overwhelming the user with 15+ input fields at once, the state machine divides them logically.
* **State Management:** React's `useState` hooks accumulate the `formData` object as the user progresses through the steps.
* **Dynamic Fetching:** Upon selecting a City in Step 1, a `useEffect` hook triggers an API call to fetch the corresponding ZIP codes for that specific city, ensuring data consistency.
* **Result Rendering:** Upon submission, the app transitions to the final step, rendering a robust dashboard utilizing conditional CSS classes (e.g., green for Grade A, red for Grade F) and Recharts for visual market comparisons.

---

## 8. UI/UX Flow Explanation

**The User Journey:**
1. **Step 1: Location:** User selects City and ZIP code.
2. **Step 2: Property Size:** User enters raw specs (Beds, Baths, Sqft Living, Sqft Lot, Floors).
3. **Step 3: Quality & Condition:** User inputs Year Built, Renovation status, Condition (1-5), and View ratings.
4. **Step 4: The Deal:** User inputs the Asking Price (optional).
5. **Step 5: Results Dashboard:** 
   * Top banner displays the **Predicted Price** and **Deal Status**.
   * Middle section provides the **Investment Grade**, ROI metrics, and a list of AI-generated Insights (textual explanations of why the score was given).
   * Bottom section visualizes the property's price-per-square-foot against the city and ZIP averages.

---

## 9. Results Interpretation

* **Predicted Price:** The AI's estimation of what the house *should* sell for, ignoring the seller's asking price.
* **Deal Status:** A quick binary check. "Undervalued" means instant equity for the buyer.
* **Investment Grade (A-F):** A holistic score that combines price, condition, age, and location. An "A" means it is an excellent long-term hold; an "F" means high risk of money loss.
* **ROI (Return on Investment):** Estimated yearly gross return if rented out.
* **Market Comparison:** Helps users realize if they are buying the most expensive house on the block (usually a bad idea) or the cheapest (usually a good idea for forced appreciation).

---

## 10. Strengths of the Project

* **Real-World Application:** Solves a highly tangible, lucrative problem (real estate valuation).
* **Hybrid Architecture:** Beautifully marries probabilistic Machine Learning (XGBoost) with deterministic Expert System rules (Investment Scoring logic).
* **High Performance:** JSON-based local aggregations and FastAPI make inferences virtually instantaneous.
* **Robust Feature Engineering:** Doesn't just use raw data; calculates ratios and interaction features that mimic how human appraisers think (e.g., `sqft_x_condition`, `bath_per_bed`).

---

## 11. Limitations

* **Temporal Data Decay:** The dataset is hardcoded to a `SALE_YEAR = 2014`. Real estate prices have shifted drastically since then; the model predicts 2014 values, not current market values.
* **Geographical Bias:** The model is trained on a localized dataset (Washington state / King County based on the `WA` prefix stripping). It cannot accurately predict properties in Florida or Texas.
* **Static Rent Yield:** The 0.6% rent rule is a massive oversimplification. Real rent yields vary wildly by neighborhood, property class, and current interest rates.
* **Lack of Images/NLP:** It evaluates tabular data but cannot parse MLS descriptions or assess property photos for modern finishes.

---

## 12. Future Improvements

* **Live Data Integration:** Hook up to external APIs (like Zillow API or MLS feeds) to pull live comps and current market trends, enabling real-time retraining.
* **Advanced ML:** Implement an ensemble model (XGBoost + LightGBM + CatBoost) or use deep learning for computer vision on property photos.
* **Geospatial Features:** Integrate Google Maps/Mapbox APIs to calculate distance to downtown, schools, and transit—critical features for real estate valuation.
* **Cloud Deployment:** Containerize the application using Docker and deploy via AWS ECS or Google Cloud Run for scalability.
* **Authentication & Saving:** Add user accounts (JWT / OAuth) so investors can save deals and track portfolio growth.

---

## 13. How to Run the Project

### Prerequisites
* Python 3.9+
* Node.js 18+

### Step 1: Backend Setup
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd ai-real-estate/backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install required dependencies:
   ```bash
   pip install fastapi uvicorn pandas scikit-learn xgboost pydantic
   ```
4. Run the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```
   *The backend will start at `http://127.0.0.1:8000`*

### Step 2: Frontend Setup
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd ai-real-estate/frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend will start at `http://localhost:5173` (or the port specified by Vite).*

**You're all set!** Open the frontend URL in your browser and start analyzing deals.
