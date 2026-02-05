import os
import json
import glob
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='build', static_url_path='')
CORS(app)

# --- ROUTES ---

@app.route('/api/flows', methods=['GET'])
def list_flows():
    """Returns a list of all saved playbook JSON files."""
    files = glob.glob("*.json")
    # Filter out package-lock or other config files if they exist accidentally
    playbooks = [f for f in files if f not in ['package.json', 'package-lock.json', 'tsconfig.json']]
    return jsonify(playbooks)

@app.route('/api/save', methods=['POST'])
def save_flow():
    try:
        data = request.json
        filename = data.get('filename', 'default_flow.json')
        
        # Ensure filename ends in .json
        if not filename.endswith('.json'):
            filename += '.json'
            
        # Remove filename from data before saving to keep file clean
        if 'filename' in data:
            del data['filename']

        with open(filename, 'w') as f:
            json.dump(data, f)
        
        return jsonify({"message": f"Saved to {filename}!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/load', methods=['GET'])
def load_flow():
    filename = request.args.get('filename', 'default_flow.json')
    
    if not os.path.exists(filename):
        # Return empty structure if file doesn't exist yet
        return jsonify({"nodes": [], "edges": [], "carriers": {}, "quoteSettings": {}}), 200
    try:
        with open(filename, 'r') as f:
            data = json.load(f)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- SERVE FRONTEND ---

@app.route('/')
def serve():
    if os.path.exists(os.path.join(app.static_folder, 'index.html')):
        return send_from_directory(app.static_folder, 'index.html')
    else:
        return "Frontend build not found. Please run 'npm run build'", 404

@app.route('/<path:path>')
def static_proxy(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)