from flask import Flask, render_template, request, jsonify
import joblib
import pandas as pd
import numpy as np
import ast

app = Flask(__name__)

# Load models and scalers
xgb_eta = joblib.load("xgb_eta_model.pkl")
xgb_dist = joblib.load("xgb_dist_model.pkl")
scaler_eta = joblib.load("scaler_eta.pkl")
scaler_dist = joblib.load("scaler_distance.pkl")
model_features = joblib.load("model_features.pkl")

# Load path data
df = pd.read_csv("preprocessed_data.csv")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    try:
        start_lat = float(request.form['start_lat'])
        start_lon = float(request.form['start_lon'])
        end_lat = float(request.form['end_lat'])
        end_lon = float(request.form['end_lon'])

        input_data = pd.DataFrame([[start_lat, start_lon, end_lat, end_lon]], columns=model_features)

        # Load scalers
        scaler_eta = joblib.load("scaler_eta.pkl")
        scaler_dist = joblib.load("scaler_distance.pkl")

        # Predict (scaled)
        predicted_eta_scaled = xgb_eta.predict(input_data)[0]
        predicted_distance_scaled = xgb_dist.predict(input_data)[0]

        # Inverse transform to get actual values
        predicted_eta = scaler_eta.inverse_transform([[predicted_eta_scaled]])[0][0]
        predicted_distance = scaler_dist.inverse_transform([[predicted_distance_scaled]])[0][0]

        return jsonify({
            "eta": round(predicted_eta, 2),
            "distance": round(predicted_distance, 2)
        })

    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"})

@app.route('/path', methods=['GET'])
def get_path():
    try:
        start_lat = float(request.args.get('start_lat'))
        start_lon = float(request.args.get('start_lon'))
        end_lat = float(request.args.get('end_lat'))
        end_lon = float(request.args.get('end_lon'))

        path_data = df[
            (df['Start_Lat'] == start_lat) & (df['Start_Lon'] == start_lon) &
            (df['End_Lat'] == end_lat) & (df['End_Lon'] == end_lon)
        ]

        if path_data.empty:
            return jsonify({"error": "Path not found"})

        path = path_data.iloc[0]['Path']
        path_coordinates = ast.literal_eval(path)

        return jsonify({"path": path_coordinates})

    except Exception as e:
        print("❌ Path error:", str(e))
        return jsonify({"error": f"Path lookup failed: {str(e)}"})

if __name__ == '__main__':
    app.run(debug=True)
