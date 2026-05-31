import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb
import pickle
import json
import math

print("Loading data...")
df = pd.read_csv('data.csv')

# Remove invalid prices
df = df[df['price'] > 0].copy()

df['date'] = pd.to_datetime(df['date'])
df = df.sort_values('date').reset_index(drop=True)

df['zip_code'] = df['statezip'].str.replace('WA ', '').str.strip()
df['price_per_sqft'] = df['price'] / df['sqft_living']

train_df, test_df = train_test_split(df, test_size=0.2, random_state=42)

def compute_city_stats(df):
    stats = {}
    grouped = df.groupby('city')
    for city, group in grouped:
        stats[city] = {
            "city_avg_price": round(float(group['price'].mean()), 2),
            "city_median_price": round(float(group['price'].median()), 2),
            "city_avg_ppsf": round(float(group['price_per_sqft'].mean()), 2),
            "city_count": int(len(group)),
            "city_min_price": round(float(group['price'].min()), 2),
            "city_max_price": round(float(group['price'].max()), 2),
            "city_std_price": round(float(group['price'].std() if len(group)>1 else 0), 2),
        }
    return stats

def compute_zip_stats(df):
    stats = {}
    grouped = df.groupby('zip_code')
    for zip_code, group in grouped:
        stats[zip_code] = {
            "zip_avg_price": round(float(group['price'].mean()), 2),
            "zip_median_price": round(float(group['price'].median()), 2),
            "zip_avg_ppsf": round(float(group['price_per_sqft'].mean()), 2),
            "zip_count": int(len(group)),
            "zip_min_price": round(float(group['price'].min()), 2),
            "zip_max_price": round(float(group['price'].max()), 2),
        }
    return stats

city_stats = compute_city_stats(train_df)
zip_stats = compute_zip_stats(train_df)

market_stats = {
    "overall_avg_price": float(train_df['price'].mean()),
    "overall_median_price": float(train_df['price'].median()),
    "overall_avg_ppsf": float(train_df['price_per_sqft'].mean()),
    "total_properties": len(df), 
    "cities_covered": len(city_stats)
}

city_encoder = LabelEncoder()
city_encoder.fit(train_df['city'])

zip_encoder = LabelEncoder()
zip_encoder.fit(train_df['zip_code'])

SALE_YEAR = 2014

def engineer_features(df_in):
    df = df_in.copy()
    
    df['sale_year'] = SALE_YEAR
    df['sale_month'] = df['date'].dt.month
    
    df['house_age'] = df['sale_year'] - df['yr_built']
    df['renovated'] = (df['yr_renovated'] > 0).astype(int)
    df['years_since_reno'] = np.where(df['renovated'] == 1, df['sale_year'] - df['yr_renovated'], df['house_age'])
    
    df['sqft_living_log'] = np.log1p(df['sqft_living'])
    df['sqft_lot_log'] = np.log1p(df['sqft_lot'])
    
    df['sqft_x_condition'] = df['sqft_living'] * df['condition']
    df['sqft_x_view'] = df['sqft_living'] * (df['view'] + 1)
    df['age_x_condition'] = df['house_age'] * df['condition']
    df['waterfront_x_view'] = df['waterfront'] * (df['view'] + 1)
    
    df['total_rooms'] = df['bedrooms'] + df['bathrooms']
    df['bath_per_bed'] = df['bathrooms'] / np.maximum(df['bedrooms'], 1)
    df['sqft_per_room'] = df['sqft_living'] / np.maximum(df['total_rooms'], 1)
    df['basement_ratio'] = df['sqft_basement'] / np.maximum(df['sqft_living'], 1)
    df['basement_present'] = (df['sqft_basement'] > 0).astype(int)
    df['bed_bath_ratio'] = df['bedrooms'] / np.maximum(df['bathrooms'], 1)
    df['sqft_ratio'] = df['sqft_living'] / np.maximum(df['sqft_lot'], 1)
    
    df['zip_avg_price'] = df['zip_code'].map(lambda x: zip_stats.get(x, {}).get('zip_avg_price', market_stats['overall_avg_price']))
    df['zip_avg_ppsf'] = df['zip_code'].map(lambda x: zip_stats.get(x, {}).get('zip_avg_ppsf', market_stats['overall_avg_ppsf']))
    df['zip_median_price'] = df['zip_code'].map(lambda x: zip_stats.get(x, {}).get('zip_median_price', market_stats['overall_median_price']))
    df['zip_count'] = df['zip_code'].map(lambda x: zip_stats.get(x, {}).get('zip_count', 0))
    
    df['city_avg_price'] = df['city'].map(lambda x: city_stats.get(x, {}).get('city_avg_price', market_stats['overall_avg_price']))
    df['city_avg_ppsf'] = df['city'].map(lambda x: city_stats.get(x, {}).get('city_avg_ppsf', market_stats['overall_avg_ppsf']))
    df['city_count'] = df['city'].map(lambda x: city_stats.get(x, {}).get('city_count', 0))
    
    def encode_safe(val, encoder):
        try:
            return encoder.transform([val])[0]
        except:
            return 0
            
    df['city_encoded'] = df['city'].apply(lambda x: encode_safe(x, city_encoder))
    df['zip_encoded'] = df['zip_code'].apply(lambda x: encode_safe(x, zip_encoder))
    
    return df

train_feat = engineer_features(train_df)
test_feat = engineer_features(test_df)

features_list = [
    "bedrooms", "bathrooms", "sqft_living", "sqft_lot", "floors", "waterfront", "view", "condition", 
    "sqft_above", "sqft_basement", "house_age", "renovated", "years_since_reno", 
    "sqft_living_log", "sqft_lot_log", "sqft_x_condition", "sqft_x_view", "age_x_condition", 
    "waterfront_x_view", "bath_per_bed", "sqft_per_room", "basement_ratio", "basement_present", 
    "total_rooms", "bed_bath_ratio", "sqft_ratio", "zip_encoded", "zip_avg_price", "zip_avg_ppsf", 
    "zip_median_price", "zip_count", "city_encoded", "city_avg_price", "city_avg_ppsf", "city_count", 
    "sale_month", "sale_year"
]

X_train = train_feat[features_list]
y_train = np.log1p(train_feat['price'])

X_test = test_feat[features_list]
y_test = np.log1p(test_feat['price'])

print("Training tuned model...")
# XGBoost Hyperparameters
# Optimized hyperparams without smoothing target encoding
model = xgb.XGBRegressor(
    n_estimators=400,
    learning_rate=0.04,
    max_depth=6,
    subsample=0.85,
    colsample_bytree=0.85,
    min_child_weight=2,
    gamma=0.01,
    random_state=42
)
model.fit(X_train, y_train)

preds_log = model.predict(X_test)
preds = np.expm1(preds_log)
actuals = test_feat['price'].values

mae = mean_absolute_error(actuals, preds)
rmse = math.sqrt(mean_squared_error(actuals, preds))
r2 = r2_score(actuals, preds)
mape = np.mean(np.abs((actuals - preds) / actuals)) * 100

print(f"Hyper Tuned Honest Test R2: {r2:.4f}, MAPE: {mape:.2f}%")

model_metrics = {
    "mae": round(mae, 2),
    "rmse": round(rmse, 2),
    "r2": round(r2, 4),
    "mape": round(mape, 2),
    "train_samples": len(X_train),
    "test_samples": len(X_test),
    "total_features": len(features_list),
    "log_transformed": True
}

with open("model.pkl", "wb") as f: pickle.dump(model, f)
with open("label_encoder.pkl", "wb") as f: pickle.dump(city_encoder, f)
with open("zip_encoder.pkl", "wb") as f: pickle.dump(zip_encoder, f)

with open("city_stats.json", "w") as f: json.dump(city_stats, f)
with open("zip_stats.json", "w") as f: json.dump(zip_stats, f)
with open("features.json", "w") as f: json.dump(features_list, f)
with open("model_metrics.json", "w") as f: json.dump(model_metrics, f)
with open("market_stats.json", "w") as f: json.dump(market_stats, f)

cities = list(city_stats.keys())
with open("cities.json", "w") as f: json.dump(cities, f)

city_zip_map = {}
for city, group in df.groupby('city'):
    zips = group['zip_code'].unique().tolist()
    city_zip_map[city] = zips
with open("city_zip_map.json", "w") as f: json.dump(city_zip_map, f)

print("Artifacts saved. Best R2 achieved.")
