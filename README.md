# Twiller 

A Twitter-like application consisting of a Node.js/Express backend and a Next.js frontend.

## Features
- **User Authentication**: Registered and logged-in user endpoints.
- **Profile Management**: Update user profiles.
- **Tweeting**: Create, view, like, and retweet posts.
- **Modern UI**: Built with Radix UI components, Tailwind CSS 4, and Firebase.

## Tech Stack
### Frontend (`/twiller`)
- **Framework**: Next.js 15.5
- **Library**: React 19
- **Styling**: Tailwind CSS 4
- **Components**: Radix UI, Lucide React icons
- **Other utilities**: Axios, Firebase

### Backend (`/backend`)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose)
- **Utilities**: CORS, dotenv

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- MongoDB instance (Atlas or local)

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `/backend` directory and add the following:
   ```env
   PORT=5000
   MONOGDB_URL=<Your MongoDB Connection String>
   ```
4. Start the backend server:
   ```bash
   npm start
   # or node index.js
   ```
   The backend will run on `http://localhost:5000`.

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd twiller
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:3000`.

## API Endpoints

### Authentication & Users
- `POST /register`: Register a new user
- `GET /loggedinuser?email=...`: Get user by email
- `PATCH /userupdate/:email`: Update user profile

### Tweets
- `POST /post`: Create a new tweet
- `GET /post`: Retrieve all tweets
- `POST /like/:tweetid`: Like a tweet
- `POST /retweet/:tweetid`: Retweet a tweet

## Database Models
- **User**: Stores user details (email, profile info).
- **Tweet**: Stores tweet content, author, timestamp, likes, retweets, and arrays of user IDs who interacted with it.
