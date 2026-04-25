# JSPCS POS Backend System

A complete backend solution for the JSPCS Point of Sale system, built with Spring Boot 3, Java 17, and PostgreSQL.

## Prerequisites

- Java 17 or higher
- Maven 3.8+
- Docker & Docker Compose (optional, for DB/running)
- PostgreSQL 15 (local or via Docker)

## Project Structure

- `src/main/java`: Source code
- `src/main/resources`: Configuration and DB migrations
- `docker-compose.yml`: Local infrastructure setup

## Build Instructions

1. **Clone the repository** (if applicable)
2. **Build with Maven**:
   ```bash
   mvn clean install
   ```
   This will compile the code, run tests, and generate the JAR file in `target/`.

## Run Instructions

### Option 1: Using Docker Compose (Recommended)

This will start both the Database and the Application.

1. Build the image:
   ```bash
   mvn clean package -DskipTests
   ```
2. Run Docker Compose:
   ```bash
   docker-compose up --build
   ```
3. Access the API at `http://localhost:8080`.

### Option 2: Local Development

1. Start PostgreSQL (e.g., using Docker):
   ```bash
   docker-compose up db -d
   ```
2. Run the application:
   ```bash
   mvn spring-boot:run
   ```

## API Documentation

- Swagger UI (if enabled): `http://localhost:8080/swagger-ui.html`
- API Base URL: `http://localhost:8080/api/v1`

### Key Endpoints

- **Auth**: `POST /api/v1/auth/login`
- **Users**: `GET /api/v1/users`
- **Products**: `GET /api/v1/products`
- **Sales**: `POST /api/v1/sales/invoices`

## Database Migrations

This project uses Flyway for database migrations. Scripts are located in `src/main/resources/db/migration`.
When the application starts, it will automatically migrate the database to the latest schema.

## License

Copyright (c) 2024 JSPCS. All rights reserved.
# jspcs-pos
# Jspcs-restaurant
