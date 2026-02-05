import os
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Initialize Flask. 
# static_folder='build' tells Flask to look for the React build files in the 'build' folder.
app = Flask(__name__, static_folder='build', static_url_path='')

# Enable CORS (Cross-Origin Resource Sharing)
CORS(app)

# The file where your diagram data is saved
DATA_FILE = 'flow_data.json'

# --- API ROUTES (For saving/loading the flow) ---

@app.route('/api/save', methods=['POST'])
def save_flow():
    try:
        data = request.json
        # write to a local file
        with open(DATA_FILE, 'w') as f:
            json.dump(data, f)
        return jsonify({"message": "Flow saved successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/load', methods=['GET'])
def load_flow():
    if not os.path.exists(DATA_FILE):
        # Return empty structure if file doesn't exist yet
        return jsonify({"nodes": [], "edges": [], "carriers": {}, "quoteSettings": {}}), 200
    try:
        with open(DATA_FILE, 'r') as f:
            data = json.load(f)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- FRONTEND ROUTES (For serving the React App) ---

@app.route('/')
def serve():
    # Serve the index.html from the build folder
    if os.path.exists(os.path.join(app.static_folder, 'index.html')):
        return send_from_directory(app.static_folder, 'index.html')
    else:
        return "Frontend build not found. Please run 'npm run build' and move the 'build' folder here.", 404

@app.route('/<path:path>')
def static_proxy(path):
    # This serves static files (like .js, .css, images)
    file_path = os.path.join(app.static_folder, path)
    if os.path.exists(file_path):
        return send_from_directory(app.static_folder, path)
    
    # If the file doesn't exist (and it's not an API call), 
    # return index.html to let React Router handle the URL.
    return send_from_directory(app.static_folder, 'index.html')

# --- MAIN ENTRY POINT ---

if __name__ == '__main__':
    # '0.0.0.0' allows external access (required for Render/Docker)
    # Get port from environment variable or default to 5001
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)