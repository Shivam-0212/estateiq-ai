# Use the official Python base image
FROM python:3.11-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file and install dependencies
# We create a temporary requirements.txt inline for the build
RUN pip install fastapi uvicorn pydantic scikit-learn xgboost pandas numpy google-generativeai

# Copy all backend files into the container
COPY . /app/

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
