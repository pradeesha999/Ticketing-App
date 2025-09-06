#!/bin/bash

echo "Setting up Ticketing System Backend..."

# Check if MongoDB is installed
if ! command -v mongod &> /dev/null; then
    echo "MongoDB is not installed. Installing MongoDB..."
    
    # Install MongoDB using the official repository
    wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
    
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    
    sudo apt-get update
    sudo apt-get install -y mongodb-org
    
    # Start MongoDB service
    sudo systemctl start mongod
    sudo systemctl enable mongod
    
    echo "MongoDB installed and started successfully!"
else
    echo "MongoDB is already installed."
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
PORT=5000
MONGO_URI=mongodb://localhost:27017/ticketing-system
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
EOF
    echo ".env file created successfully!"
else
    echo ".env file already exists."
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Seed the database
echo "Seeding the database..."
npm run seed

echo "Setup completed successfully!"
echo "You can now start the server with: npm run dev"
