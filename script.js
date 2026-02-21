document.addEventListener('DOMContentLoaded', function () {

    // General Tab Navigation Functionality
    function showTab(tabId) {
        const tabs = document.querySelectorAll('.tab-content');
        tabs.forEach(tab => tab.style.display = 'none'); // Hide all tabs
        document.getElementById(tabId).style.display = 'block'; // Show selected tab
    }

    // Initialize with the first tab on both student and teacher dashboards
    const defaultTab = document.querySelector('.tab-content')?.id || 'home';
    showTab(defaultTab); // Show default tab at load

    // Assign tab event listeners (for both Student and Teacher dashboards)
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.dataset.tab && button.addEventListener('click', () => showTab(button.dataset.tab));
    });
    let chartInstance = null; // Global variable to hold the chart instance
    let datasets = []; // Array to hold multiple datasets (graphs)
    // For Student Dashboard
    if (document.getElementById('plotGraphBtn')) {
        // Plot Graph for Student
       
        let chartInstance = null; // Global variable to hold the chart instance
    let datasets = []; // Array to hold multiple datasets (graphs)

    // Handle Graph Plotting
    document.getElementById('plotGraphBtn').addEventListener('click', () => {
        const equation = document.getElementById('equation').value.trim();
        const color = document.getElementById('color').value;
        const pattern = document.getElementById('pattern').value;

        if (!equation) {
            alert("Please enter a valid equation.");
            return;
        }

        // Select canvas and context
        const ctx = document.getElementById('graphCanvas').getContext('2d');

        // Prepare data for the new dataset (graph)
        const newDataset = {
            label: `y = ${equation}`,  // Label will show the equation on the graph
            borderColor: color,
            data: [],  // Y-values will be calculated based on the equation
            borderWidth: 2,
            borderDash: [],
            fill: false
        };

        // Apply pattern to the newDataset
        if (pattern === 'dashed') {
            newDataset.borderDash = [10, 5]; // Dashed line
        } else if (pattern === 'dotted') {
            newDataset.borderDash = [2, 2]; // Dotted line
        }

        // Function to evaluate the equation and plot the graph
        const plotGraph = (equation) => {
            const graphData = [];
            for (let x = -10; x <= 10; x += 0.1) {
                try {
                    // Prepare the equation for evaluation
                    let evaluatedEquation = equation
                        .replace(/x/g, `(${x})`)   // Replace x with the actual value
                        .replace(/sin/g, 'Math.sin')
                        .replace(/cos/g, 'Math.cos')
                        .replace(/tan/g, 'Math.tan')
                        .replace(/\^/g, '**');     // Replace ^ with ** for exponentiation

                    // Safely evaluate the equation
                    const y = eval(evaluatedEquation);

                    // Check if the result is finite
                    if (isFinite(y)) {
                        graphData.push({ x, y });
                    } else {
                        console.error(`Non-finite result for x=${x}: y=${y}`);
                    }
                } catch (error) {
                    // Log specific errors for debugging but do not stop plotting for valid equations
                    console.error(`Error evaluating equation at x=${x}:`, error);
                    return []; // Stop plotting if there's an error
                }
            }
            return graphData;
        };

        // Calculate the graph data
        const graphData = plotGraph(equation);

        // If the graph data is empty, alert the user and exit
        if (!graphData || graphData.length === 0) {
            alert("No valid data points could be plotted. Please check your equation.");
            return;
        }

        newDataset.data = graphData;

        // Add the new dataset to the datasets array
        datasets.push(newDataset);

        // Clear the previous chart instance if it exists
        if (chartInstance) {
            chartInstance.destroy();
        }

        // Render chart using Chart.js with multiple datasets
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    x: {
                        title: { display: true, text: 'X-axis' },
                        type: 'linear',
                        position: 'bottom',
                        grid: {
                            display: true,
                        },
                        min: -10,
                        max: 10,
                        ticks: {
                            stepSize: 1,
                        }
                    },
                    y: {
                        title: { display: true, text: 'Y-axis' },
                        grid: {
                            display: true,
                        },
                        min: -10,
                        max: 10,
                        ticks: {
                            stepSize: 1,
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (tooltipItem) {
                                return `y = ${equation}`;
                            }
                        }
                    }
                },
                layout: {
                    padding: {
                        top: 20
                    }
                }
            }
        });
    });

    // Clear the graph
    document.getElementById('clearGraphBtn').addEventListener('click', () => {
        if (chartInstance) {
            chartInstance.destroy(); // Destroy the chart instance
            datasets = []; // Clear datasets
        }
    });
}
{

        // Save the graph as a base64 image
        document.getElementById('save-graph-form').addEventListener('submit', async function (e) {
            e.preventDefault(); // Prevent the default form submission

            const canvas = document.getElementById('graphCanvas');
            const graphImage = canvas.toDataURL('image/png');
            const equation = document.getElementById('equation').value.trim();
            const color = document.getElementById('color').value;

            if (!equation) {
                alert("Please enter a valid equation before saving.");
                return;
            }

            const response = await fetch('/save-graph', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ equation, color, graphImage })
            });

            const result = await response.json();
            alert(result.message);  // Display the result
        });

        // Load saved graphs for submission
        window.onload = async function () {
            const response = await fetch('/student-home');
            const data = await response.json();

            const select = document.getElementById('savedGraphs');
            select.innerHTML = ''; // Clear any existing options
            data.graphs.forEach(graph => {
                const option = document.createElement('option');
                option.value = graph.id; // Ensure the ID is available
                option.text = `Equation: ${graph.equation}`;
                select.appendChild(option);
            });

            // Display the username
            document.getElementById('usernameDisplay').textContent = `Logged in as: ${data.username}`;
        };

        // Submit the selected graph to a teacher
        document.getElementById('submitGraphBtn').addEventListener('click', async function () {
            const teacherUsername = prompt("Enter the teacher's username:");
            if (!teacherUsername) {
                alert("Please enter a valid teacher's username.");
                return;
            }

            const graphId = document.getElementById('savedGraphs').value;
            if (!graphId) {
                alert("Please select a graph to submit.");
                return;
            }

            const response = await fetch('/submit-graph', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherUsername, graphId })
            });

            const result = await response.json();
            alert(result.message);  // Display the result
        });
    }

    // For Teacher Dashboard
    if (document.getElementById('submittedGraphsTab')) {
        // Load submitted graphs for teacher
        document.getElementById('submittedGraphsTab').addEventListener('click', async function () {
            const response = await fetch('/teacher-home');
            const data = await response.json();

            const container = document.getElementById('submittedGraphsContainer');
            container.innerHTML = '';  // Clear previous content

            data.submittedGraphs.forEach(graph => {
                const graphDiv = document.createElement('div');
                graphDiv.classList.add('submitted-graph');

                const graphImage = document.createElement('img');
                graphImage.src = graph.graph_image;
                graphImage.alt = `Graph submitted by ${graph.student_username}`;

                const studentLabel = document.createElement('p');
                studentLabel.textContent = `Submitted by: ${graph.student_username}`;

                graphDiv.appendChild(graphImage);
                graphDiv.appendChild(studentLabel);
                container.appendChild(graphDiv);
            });
        });

        // Send feedback to students
        document.getElementById('feedback-form').addEventListener('submit', async function (e) {
            e.preventDefault();

            const studentUsername = document.getElementById('studentUsername').value.trim();
            const feedback = document.getElementById('feedbackMessage').value.trim();

            if (!studentUsername || !feedback) {
                alert("Please enter both the student's username and feedback.");
                return;
            }

            const response = await fetch('/submit-feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentUsername, feedback })
            });

            const result = await response.json();
            alert(result.message);  // Display the result
        });
    }

    // Load feedback for students
    if (document.getElementById('feedbackTab')) {
        document.getElementById('feedbackTab').addEventListener('click', async function () {
            const response = await fetch('/get-feedback');
            const feedbacks = await response.json();

            const container = document.getElementById('feedbackContainer');
            container.innerHTML = '';  // Clear previous content

            feedbacks.forEach(feedback => {
                const feedbackDiv = document.createElement('div');
                feedbackDiv.classList.add('feedback-item');

                const teacherLabel = document.createElement('p');
                teacherLabel.textContent = `Feedback from ${feedback.teacher_username}:`;

                const feedbackText = document.createElement('p');
                feedbackText.textContent = feedback.feedback;

                feedbackDiv.appendChild(teacherLabel);
                feedbackDiv.appendChild(feedbackText);
                container.appendChild(feedbackDiv);
            });
        });
    }

});






  