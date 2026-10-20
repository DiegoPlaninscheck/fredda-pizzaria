FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY previsao/ previsao/
COPY servico/ servico/

RUN useradd --create-home ia && mkdir -p /app/modelos && chown ia /app/modelos
USER ia

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/saude')"
CMD ["uvicorn", "servico.app:app", "--host", "0.0.0.0", "--port", "8000"]
