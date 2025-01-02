const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const path = require('path');
const { logger, httpLogger } = require('./middleware/logger');
const { errorHandler, AppError, catchAsync } = require('./middleware/errorHandler');
const connectDB = require('./db');
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/authMiddleware');
const { authLimiter, apiLimiter, sensorDataLimiter } = require('./middleware/rateLimiter');

// Express setup
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Connect to MongoDB with error handling
connectDB().catch(err => {
    logger.error('Database connection error:', err);
    process.exit(1);
});

// Global Express error handler for uncaught exceptions
process.on('uncaughtException', err => {
    logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', {
        error: err.name,
        message: err.message,
        stack: err.stack
    });
    process.exit(1);
});

// Middleware
app.use(express.json({
    limit: '10kb', // Limit body size
    verify: (req, res, buf) => { req.rawBody = buf } // Keep raw body for webhook verification
}));
app.use(httpLogger);

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/sensor-data', sensorDataLimiter);

// Routes
app.use('/api/auth', authRoutes);

// Static files
const staticDir = path.join(__dirname, 'public');
app.use(express.static(staticDir));

// Protected routes with error handling
app.get('/', authMiddleware, catchAsync(async (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
}));

// Arduino setup with error handling
let serialPort;
try {
    serialPort = new SerialPort({
        path: process.env.ARDUINO_PORT || '/dev/cu.usbserial-110',
        baudRate: parseInt(process.env.ARDUINO_BAUD_RATE) || 9600
    });
} catch (err) {
    logger.error('Failed to initialize Serial Port', { error: err.message });
}

// Parser setup
const parser = serialPort ? new ReadlineParser() : null;
if (parser) {
    serialPort.pipe(parser);
}

// WebSocket error handling
io.on('connection', (socket) => {
    logger.info('Client connected', { socketId: socket.id });

    socket.on('error', (error) => {
        logger.error('Socket error', { 
            socketId: socket.id, 
            error: error.message 
        });
    });

    socket.on('sendToArduino', (command) => {
        try {
            if (!serialPort || !serialPort.isOpen) {
                throw new AppError('Serial port is not available', 503);
            }
            serialPort.write(`${command}\n`);
            logger.info('Command sent to Arduino', { 
                socketId: socket.id, 
                command 
            });
        } catch (error) {
            logger.error('Failed to send command to Arduino', {
                socketId: socket.id,
                command,
                error: error.message
            });
            socket.emit('error', { message: 'Failed to send command to Arduino' });
        }
    });
});

// Handle Arduino data with error handling
if (parser) {
    parser.on('data', (data) => {
        try {
            const parsedData = JSON.parse(data.trim());
            io.emit('arduinoData', parsedData);
        } catch (error) {
            logger.error('Arduino data parsing error', {
                error: error.message,
                rawData: data
            });
        }
    });
}

if (serialPort) {
    serialPort.on('error', (error) => {
        logger.error('Serial port error', { error: error.message });
        io.emit('arduinoError', { message: 'Serial port error occurred' });
    });
}

// Handle 404 errors
app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handling middleware
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', err => {
    logger.error('UNHANDLED REJECTION! 💥 Shutting down...', {
        error: err.name,
        message: err.message,
        stack: err.stack
    });
    server.close(() => {
        process.exit(1);
    });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    logger.info('👋 SIGTERM RECEIVED. Shutting down gracefully');
    server.close(() => {
        logger.info('💥 Process terminated!');
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});