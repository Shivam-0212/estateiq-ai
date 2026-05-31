# Use the official Node.js image as a build environment
FROM node:20-alpine as build

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy all frontend files
COPY . .

# Build the React app for production
RUN npm run build

# Use Nginx to serve the built frontend files
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
