const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from React build
app.use(express.static(path.join(__dirname, 'build')));

// Configuration
const PLAYBOOKS_DIR = path.join(__dirname, 'playbooks');
const PORT = process.env.PORT || 5000;

// Ensure playbooks directory exists
async function ensureDirectories() {
    try {
        await fs.mkdir(PLAYBOOKS_DIR, { recursive: true });
        console.log('Playbooks directory ready');
    } catch (err) {
        console.error('Error creating directories:', err);
    }
}

ensureDirectories();

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Get list of all playbook files
app.get('/api/flows', async (req, res) => {
    try {
        const files = await fs.readdir(PLAYBOOKS_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        if (jsonFiles.length === 0) {
            return res.json(['default_flow.json']);
        }
        
        res.json(jsonFiles);
    } catch (err) {
        console.error('Error reading flows:', err);
        res.json(['default_flow.json']);
    }
});

// Load a specific playbook
app.get('/api/load', async (req, res) => {
    try {
        const filename = req.query.filename || 'default_flow.json';
        const filepath = path.join(PLAYBOOKS_DIR, filename);
        
        const data = await fs.readFile(filepath, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.log(`Playbook not found, returning empty: ${req.query.filename}`);
        res.json({
            nodes: [],
            edges: [],
            carriers: {},
            resources: [],
            quoteSettings: {},
            callTypes: ["Quote", "Sale", "Billing", "Service", "Claims", "Other"],
            issues: []
        });
    }
});

// Save a playbook
app.post('/api/save', async (req, res) => {
    try {
        const data = req.body;
        const filename = data.filename || 'default_flow.json';
        const filepath = path.join(PLAYBOOKS_DIR, filename);
        
        await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
        
        res.json({ 
            message: 'Playbook saved successfully',
            filename: filename 
        });
    } catch (err) {
        console.error('Error saving playbook:', err);
        res.status(500).json({ 
            message: 'Error saving playbook',
            error: err.message 
        });
    }
});

// Rename a playbook
app.post('/api/rename_flow', async (req, res) => {
    try {
        const { oldFilename, newFilename } = req.body;
        
        if (!oldFilename || !newFilename) {
            return res.status(400).json({ message: 'Missing filename parameters' });
        }
        
        const oldPath = path.join(PLAYBOOKS_DIR, oldFilename);
        const newPath = path.join(PLAYBOOKS_DIR, newFilename);
        
        // Check if old file exists
        await fs.access(oldPath);
        
        // Rename the file
        await fs.rename(oldPath, newPath);
        
        res.json({ 
            message: 'Playbook renamed successfully',
            newFilename: newFilename 
        });
    } catch (err) {
        console.error('Error renaming playbook:', err);
        res.status(500).json({ 
            message: 'Error renaming playbook',
            error: err.message 
        });
    }
});

// Delete a playbook
app.post('/api/delete_flow', async (req, res) => {
    try {
        const { filename } = req.body;
        
        if (!filename) {
            return res.status(400).json({ message: 'Missing filename parameter' });
        }
        
        const filepath = path.join(PLAYBOOKS_DIR, filename);
        
        await fs.unlink(filepath);
        
        res.json({ message: 'Playbook deleted successfully' });
    } catch (err) {
        console.error('Error deleting playbook:', err);
        res.status(500).json({ 
            message: 'Error deleting playbook',
            error: err.message 
        });
    }
});

// Copy/duplicate a playbook
app.post('/api/copy_flow', async (req, res) => {
    try {
        const { sourceFilename, newFilename } = req.body;
        
        if (!sourceFilename || !newFilename) {
            return res.status(400).json({ message: 'Missing filename parameters' });
        }
        
        const sourcePath = path.join(PLAYBOOKS_DIR, sourceFilename);
        const newPath = path.join(PLAYBOOKS_DIR, newFilename);
        
        // Read source file
        const data = await fs.readFile(sourcePath, 'utf8');
        
        // Write to new file
        await fs.writeFile(newPath, data, 'utf8');
        
        res.json({ 
            message: 'Playbook copied successfully',
            newFilename: newFilename 
        });
    } catch (err) {
        console.error('Error copying playbook:', err);
        res.status(500).json({ 
            message: 'Error copying playbook',
            error: err.message 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        playbooksDir: PLAYBOOKS_DIR
    });
});

// ============================================================================
// SERVE REACT APP
// ============================================================================

// All other requests serve the React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🚀 Insurance Wizard Server Started');
    console.log('='.repeat(60));
    console.log(`📍 Server running on port ${PORT}`);
    console.log(`🌐 Access at: http://localhost:${PORT}`);
    console.log(`📁 Playbooks directory: ${PLAYBOOKS_DIR}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});