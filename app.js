const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static HTML, CSS, JS files
app.use(express.static(__dirname));

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API Route for Form Submission
app.post('/api/submit', (req, res) => {
    const { username, projectTitle } = req.body;

    if (!username || !projectTitle) {
        return res.status(400).json({ 
            error: 'Please fill in both fields!' 
        });
    }

    res.status(200).json({ 
        message: `Success! ${username}'s project "${projectTitle}" has been submitted.` 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
