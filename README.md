# Service Tracker API

Backend API for Service Tracker Mobile App

## Deployment

This app is deployed on Render and uses Aiven MySQL cloud database.

### Environment Variables Required

- `DB_HOST` - MySQL host
- `DB_PORT` - MySQL port  
- `DB_USER` - MySQL username
- `DB_PASSWORD` - MySQL password
- `DB_NAME` - Database name
- `DB_SSL` - Set to 'true' for SSL connection

## Local Development

1. Install dependencies: `npm install`
2. Create `.env` file with database credentials
3. Start server: `npm start`
4. Server runs on `http://localhost:3000`

## API Endpoints

- `POST /api/login` - User authentication
- `GET /api/dashboard-stats` - Dashboard statistics
- `GET /api/customers` - Get all customers
- `GET /api/service-calls` - Get all service calls
- `GET /api/repair-records` - Get repair records
- `GET /api/amc` - Get AMC records
- And more...

## Tech Stack

- Node.js
- Express.js
- MySQL (Aiven Cloud)
- dotenv for environment variables
