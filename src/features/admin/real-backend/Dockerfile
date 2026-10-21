FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends libzbar0 poppler-utils tesseract-ocr tesseract-ocr-spa && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements/base.txt /tmp/requirements.txt
# EasyOCR downloads PyTorch/models. This integration environment exercises the
# real API, PostgreSQL, Redis, S3 and the available Tesseract engine instead.
RUN sed '/^easyocr/d' /tmp/requirements.txt > /tmp/integration.txt && pip install --no-cache-dir -r /tmp/integration.txt
RUN pip install --no-cache-dir 'pytest>=8,<9' 'pytest-django>=4.9,<5'
