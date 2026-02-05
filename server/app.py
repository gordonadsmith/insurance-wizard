import os
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='build')
CORS(app)

# --- CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FLOWS_DIR = os.path.join(BASE_DIR, 'flows')

# 1. Ensure storage directory exists
if not os.path.exists(FLOWS_DIR):
    os.makedirs(FLOWS_DIR)

# 2. CRITICAL FIX: Ensure 'default_flow.json' actually exists on disk
default_file_path = os.path.join(FLOWS_DIR, 'default_flow.json')
if not os.path.exists(default_file_path):
    print("Creating default_flow.json...")
    with open(default_file_path, 'w') as f:
        # Create a basic valid JSON structure
        initial_data = {
            "nodes": [
                {
                    "id": "1", 
                    "type": "scriptNode", 
                    "position": {"x": 250, "y": 150}, 
                    "data": {"label": "Start", "text": "Welcome to the Insurance Wizard", "isStart": True}
                }
            ],
            "edges": [],
            "carriers": {},
            "resources": []
        }
        json.dump(initial_data, f, indent=2)

print(f"Server ready. Flows directory: {FLOWS_DIR}")

@app.route('/api/flows', methods=['GET'])
def get_flows():
    try:
        files = [f for f in os.listdir(FLOWS_DIR) if f.endswith('.json')]
        return jsonify(files)
    except Exception as e:
        return jsonify([])

@app.route('/api/load', methods=['GET'])
def load_flow():
    filename = request.args.get('filename', 'default_flow.json')
    filename = os.path.basename(filename)
    
    filepath = os.path.join(FLOWS_DIR, filename)
    
    # Fallback: Try adding .json if missing
    if not os.path.exists(filepath) and not filename.endswith('.json'):
        filepath += '.json'

    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            return f.read()
    return jsonify({}) 

@app.route('/api/save', methods=['POST'])
def save_flow():
    data = request.json
    filename = data.get('filename', 'default_flow.json')
    filename = os.path.basename(filename)

    if not filename.endswith('.json'):
        filename += '.json'

    filepath = os.path.join(FLOWS_DIR, filename)
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)
    
    return jsonify({"message": "Saved successfully!"})

@app.route('/api/rename_flow', methods=['POST'])
def rename_flow():
    data = request.json
    old_name = data.get('oldFilename')
    new_name = data.get('newFilename')

    if not old_name or not new_name:
        return jsonify({"message": "Missing filenames"}), 400
    
    old_name = os.path.basename(old_name)
    new_name = os.path.basename(new_name)

    if not new_name.endswith('.json'):
        new_name += '.json'

    old_path = os.path.join(FLOWS_DIR, old_name)
    
    # Auto-fix extension for old file search
    if not os.path.exists(old_path) and not old_name.endswith('.json'):
        old_path += '.json'

    new_path = os.path.join(FLOWS_DIR, new_name)

    if not os.path.exists(old_path):
        # Create it if it's missing (Ghost file fix)
        with open(old_path, 'w') as f:
            json.dump({"nodes": []}, f)
            
    if os.path.exists(new_path):
        return jsonify({"message": "A playbook with that name already exists"}), 409

    try:
        os.rename(old_path, new_path)
        return jsonify({"message": "Renamed successfully", "newFilename": new_name})
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@app.route('/api/delete_flow', methods=['POST'])
def delete_flow():
    data = request.json
    filename = data.get('filename')

    if not filename:
        return jsonify({"message": "Missing filename"}), 400

    filename = os.path.basename(filename)
    filepath = os.path.join(FLOWS_DIR, filename)

    if not os.path.exists(filepath) and not filename.endswith('.json'):
        filepath += '.json'

    if not os.path.exists(filepath):
        return jsonify({"message": f"File not found: {filename}"}), 404

    try:
        os.remove(filepath)
        return jsonify({"message": "Deleted successfully"})
    except Exception as e:
        return jsonify({"message": str(e)}), 500

# Serve React App
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)