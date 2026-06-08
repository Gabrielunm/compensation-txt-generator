# Compensation TXT Generator

Genera archivos TXT de compensación **RAFAMR01** a partir de facturas PDF (Tipo 7). Todo se procesa **localmente en el navegador** — no se sube ningún dato a ningún servidor.

## ⚙️ Requisitos

- Navegador moderno (Chrome, Edge, Firefox)
- Python 3 (solo para desarrollo local — los ES modules requieren HTTP)

## 🚀 Uso

```powershell
cd compensation-app
python serve.py
# o: python -m http.server 8000
```

Abrí `http://localhost:8000` en el navegador.

### Para GitHub Pages

Subí la carpeta `compensation-app/` a un repositorio de GitHub y activá GitHub Pages desde `Settings > Pages > Source: main / (root)`. La app funciona sin servidor.

## 🧪 Tests

```powershell
cd compensation-app
npm install
npm test          # 264 tests, todos pasando
npm run lint      # ESLint 0 errores
```

## 📦 ¿Qué hace?

1. **Subí** 100–400 PDFs (arrastrar y soltar o seleccionar)
2. **Elegí** la fecha de pago del lote
3. **Procesá** — extrae el código de barra de 50 dígitos de cada PDF, valida dígito verificador, parsea campos
4. **Descargá** un ZIP con:
   - `RAFAMR01_YYYYMMDD.txt` — registros de compensación
   - `Informe_YYYYMMDD.xlsx` — reporte en Excel con Detalle y Resumen
   - `facturas_YYYYMMDD/` — PDFs originales

## 🎨 Personalización

Para usar con otro municipio/entidad, editá `js/theme.js`:

```js
entity: {
  code: '0135',     // Código de ente (4 dígitos)
  name: 'Hurlingham',
},
colors: {
  primary: '#00ad9c',
  // ...paleta de colores
}
```

También reemplazá `assets/logo.png` y `assets/logo-white.png`.

## 📁 Estructura

```
compensation-app/
├── index.html                 ← Página principal
├── css/style.css              ← Estilos (Pico CSS + overrides)
├── js/
│   ├── app.js                 ← Orquestador principal
│   ├── config.js              ← Configuración
│   ├── theme.js               ← Tema (colores, logo, fuentes)
│   ├── atoms/                 ← Componentes atómicos (Button, Badge, Icon)
│   ├── molecules/             ← Componentes moleculares (FileDropZone, DatePickerField)
│   ├── organisms/             ← Componentes organismo (UploadPanel, ProcessingQueue, ResultsTable, CompensationReport)
│   ├── services/              ← Servicios (barcode-parser, check-digit, rafam-builder, pdf-extractor)
│   ├── utils/                 ← Utilidades (format)
│   └── __tests__/             ← Tests (Jest)
├── assets/
│   ├── logo.png               ← Logo color
│   └── logo-white.png         ← Logo blanco
├── serve.py                   ← Servidor de desarrollo
├── serve.bat                  ← Acceso directo (doble click)
├── .gitignore
├── package.json
└── README.md
```

## 🧰 Stack

| Tecnología | Uso |
|---|---|
| Pico CSS v2 | Framework CSS (minimalista) |
| Lucide v0.468 | Iconos SVG |
| pdf.js v3 | Extracción de texto de PDFs |
| Zod v3 | Validación de esquemas |
| Driver.js | Tour interactivo |
| JSZip v3 | Compresión ZIP |
| Jest | Tests unitarios |
| ESLint | Linter estricto |
