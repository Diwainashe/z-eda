# Use official Python image as the base
FROM python:3.9-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install R and necessary dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    r-base \
    build-essential \
    libcurl4-gnutls-dev \
    libssl-dev \
    libxml2-dev \
    libpcre2-dev \
    liblzma-dev \
    libbz2-dev \
    zlib1g-dev \
    libblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*


# Create a non-root user and group
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Set work directory
WORKDIR /code

# Install dependencies
COPY requirements.txt /code/
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy project
COPY . /code/

# Create the STATIC_ROOT directory
RUN mkdir -p /code/staticfiles

# Collect static files (if applicable)
RUN python manage.py collectstatic --noinput

# Start the Django development server
#CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
