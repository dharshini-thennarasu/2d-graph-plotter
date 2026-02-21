// Importing required modules
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const path = require('path');
const session = require('express-session');
const morgan = require('morgan');  // For logging HTTP requests
const { body, validationResult } = require('express-validator');  // For input validation
const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'));  // Log HTTP requests

// Setup session middleware (disable secure cookies for development)
app.use(session({
    secret: 'dhar2004',  // Change this in production to a strong secret
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false,  // Set to false for local development (set to true in production over HTTPS)
        maxAge: 24 * 60 * 60 * 1000  // 1 day expiration
    }
}));

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',  // Update with your MySQL password
    database: 'graph_plotter_db',  // Update with your database name
});

// Connect to MySQL
db.connect(err => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL');
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        res.redirect('/login');
    }
}

// Middleware to check role-based access control
function ensureRole(role) {
    return (req, res, next) => {
        if (req.session.user && req.session.user.role === role) {
            next();
        } else {
            res.status(403).send('Access denied');
        }
    };
}

// Route to serve login page (GET request)
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route to serve student dashboard
app.get('/student-dashboard', isAuthenticated, ensureRole('student'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'student-dashboard.html'));
});

// Route to serve teacher dashboard
app.get('/teacher-dashboard', isAuthenticated, ensureRole('teacher'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teacher-dashboard.html'));
});

// Get student's saved graphs for the home tab
app.get('/student-home', isAuthenticated, ensureRole('student'), (req, res) => {
    const studentUsername = req.session.user.username;

    const query = 'SELECT * FROM graphs WHERE student_username = ?';
    db.query(query, [studentUsername], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err });
        }
        res.json({ username: studentUsername, graphs: results });
    });
});

// Get submitted graphs for teacher's home tab
app.get('/teacher-home', isAuthenticated, ensureRole('teacher'), (req, res) => {
    const teacherUsername = req.session.user.username;

    const query = `SELECT g.equation, g.color, g.graph_image, sg.student_username 
                   FROM submitted_graphs sg 
                   JOIN graphs g ON sg.graph_id = g.id 
                   WHERE sg.teacher_username = ?`;
    db.query(query, [teacherUsername], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err });
        }
        res.json({ username: teacherUsername, submittedGraphs: results });
    });
});

// Registration route (for new users)
app.post('/register', [
    body('username').trim().isAlphanumeric().withMessage('Username must be alphanumeric'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('role').isIn(['student', 'teacher']).withMessage('Role must be student or teacher')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);  // Stronger hashing with 12 salt rounds
    const query = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';

    db.query(query, [username, hashedPassword, role], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err });
        }
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    });
});

// Login route (POST request)
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], async (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err });
        }

        if (results.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        // Set session
        req.session.user = { username: user.username, role: user.role };

        // Redirect to the student dashboard or role-specific dashboard
        if (user.role === 'student') {
            return res.redirect('/student-dashboard');
        } else if (user.role === 'teacher') {
            return res.redirect('/teacher-dashboard');
        } else {
            return res.status(403).json({ message: 'Access denied' });
        }
    });
});

// Logout route
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Logout failed' });
        }
        res.redirect('/login');  // Redirect to login page after logout
    });
});

// Save graph route (with image, color, and customization)
app.post('/save-graph', isAuthenticated, ensureRole('student'), (req, res) => {
    const { equation, color, pattern, graphImage } = req.body;
    const studentUsername = req.session.user.username;

    const query = 'INSERT INTO graphs (equation, color, pattern, graph_image, student_username) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [equation, color, pattern, graphImage, studentUsername], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err });
        }
        res.json({ message: 'Graph saved successfully' });
    });
});

// Submit graph to teacher
app.post('/submit-graph', isAuthenticated, ensureRole('student'), (req, res) => {
    const { teacherUsername, graphId } = req.body;
    const studentUsername = req.session.user.username;

    // Check if the teacher exists before submitting the graph
    db.query('SELECT * FROM users WHERE username = ? AND role = "teacher"', [teacherUsername], (err, teacherResults) => {
        if (err || teacherResults.length === 0) {
            return res.status(400).json({ message: 'Teacher does not exist' });
        }

        // Proceed to submit the graph
        const query = 'INSERT INTO submitted_graphs (student_username, teacher_username, graph_id) VALUES (?, ?, ?)';
        db.query(query, [studentUsername, teacherUsername, graphId], (err, result) => {
            if (err) {
                return res.status(500).json({ message: 'Database error: ' + err });
            }
            res.json({ message: 'Graph submitted to teacher successfully' });
        });
    });
});

// Submit feedback route
app.post('/submit-feedback', isAuthenticated, ensureRole('teacher'), (req, res) => {
    const { studentUsername, feedback } = req.body;
    const teacherUsername = req.session.user.username;

    const query = 'INSERT INTO feedback (student_username, teacher_username, feedback) VALUES (?, ?, ?)';
    db.query(query, [studentUsername, teacherUsername, feedback], (err, result) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err });
        }
        res.json({ message: 'Feedback submitted successfully' });
    });
});

// Get feedback for student
app.get('/get-feedback', isAuthenticated, ensureRole('student'), (req, res) => {
    const studentUsername = req.session.user.username;

    const query = 'SELECT * FROM feedback WHERE student_username = ?';
    db.query(query, [studentUsername], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Database error: ' + err });
        }
        res.json(results);
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});





