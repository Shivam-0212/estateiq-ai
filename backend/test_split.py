import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score
import xgboost as xgb

df = pd.read_csv('data.csv')
df = df[df['price'] > 0].copy()
df['zip_code'] = df['statezip'].str.replace('WA ', '').str.strip()

train_df, test_df = train_test_split(df, test_size=0.2, random_state=42)

def comp_stats(d):
    z = d.groupby('zip_code')['price'].mean().to_dict()
    c = d.groupby('city')['price'].mean().to_dict()
    return z, c

zip_stats, city_stats = comp_stats(train_df)

def feats(d, z_s, c_s):
    d = d.copy()
    d['zip_avg_price'] = d['zip_code'].map(lambda x: z_s.get(x, d['price'].mean()))
    d['city_avg_price'] = d['city'].map(lambda x: c_s.get(x, d['price'].mean()))
    d['sqft'] = d['sqft_living']
    return d[['zip_avg_price', 'city_avg_price', 'sqft']]

X_train = feats(train_df, zip_stats, city_stats)
X_test = feats(test_df, zip_stats, city_stats)

y_train = np.log1p(train_df['price'])
y_test = np.log1p(test_df['price'])

m = xgb.XGBRegressor(random_state=42)
m.fit(X_train, y_train)

p = np.expm1(m.predict(X_test))
print("Random Split R2:", r2_score(test_df['price'], p))
