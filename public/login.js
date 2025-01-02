// Wait for the DOM to load
document.addEventListener('DOMContentLoaded', () => {
    // Get the login form element
    const loginForm = document.getElementById('loginForm');

    // Add a submit event listener to the form
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent the default form submission

        // Get the form data
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            // Send a POST request to the backend login endpoint
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            // Parse the JSON response
            const data = await response.json();

            // Check if the response is successful
            if (response.ok) {
                // Display a success message
                document.getElementById('loginMessage').textContent = 'Login successful!';
                document.getElementById('loginMessage').style.color = 'green';

                // Store the JWT token in localStorage or sessionStorage
                localStorage.setItem('token', data.token);

                // Redirect the user to a protected page (e.g., dashboard)
                window.location.href = '/dashboard.html';
            } else {
                // Display an error message
                document.getElementById('loginMessage').textContent = data.msg || 'Login failed. Please try again.';
                document.getElementById('loginMessage').style.color = 'red';
            }
        } catch (err) {
            console.error('Error during login:', err);
            document.getElementById('loginMessage').textContent = 'An error occurred. Please try again.';
            document.getElementById('loginMessage').style.color = 'red';
        }
    });
});