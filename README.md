# Generador TXT de Compensación — RAFAMR01

Genera archivos TXT de compensación **RAFAMR01** a partir de facturas PDF (Tipo 7) del municipio de **Hurlingham (Partido 135, Buenos Aires)**.

Todo se procesa **localmente en el navegador** — no se sube ningún dato a ningún servidor. Los PDFs se extraen vía pdf.js del lado del cliente, los códigos de barra se parsean, validan y convierten a registros de ancho fijo de 279 caracteres según el formato RAFAM v1.3 (Formato 50 de Recaudaciones).

## ⚙️ Requisitos

- Navegador moderno (Chrome, Edge, Firefox)
- Python 3 — solo para desarrollo local (los ES modules requieren HTTP)

## 🚀 Uso

```powershell
cd compensation-app
python serve.py
# o: python -m http.server 8000
# o: npx serve .
```

Abrí `http://localhost:8000` en el navegador.

### GitHub Pages

Subí la carpeta `compensation-app/` a GitHub y activá GitHub Pages desde `Settings > Pages > Source: main / (root)`. La app funciona completamente sin servidor.

## 🧪 Tests

```powershell
cd compensation-app
npm install
npm test          # 264 tests, 3 suites, todos pasando
npm run lint      # ESLint — 0 errores
```

## 📦 Flujo de uso

1. **Subí** los archivos — **PDFs** (facturas Tipo 7), **TXT** (con código de barra de 50 dígitos) o **Excel** (plantilla con datos de compensación)
2. **Elegí** la fecha de pago del lote
3. **Seleccioná** qué vencimiento aplicar:
   - **Automático** (default): usa el importe del 1er vencimiento si la fecha de pago es menor o igual al 1er vto, sino usa el 2do
   - **1er vencimiento**: fuerza el 1er vto como fecha de pago e importe para todos los registros
   - **2do vencimiento**: fuerza el 2do vto como fecha de pago e importe para todos los registros
4. **Procesá** — genera el código de barra de 50 dígitos de cada fuente (PDF → pdf.js, TXT → texto plano, Excel → filas convertidas con dígito verificador), valida, parsea campos, arma el registro de 279 caracteres
5. **Descargá** un ZIP con:
   - `RAFAMR01_YYYYMMDD.txt` — registros de compensación (formato ancho fijo)
   - `Informe_YYYYMMDD.xlsx` — reporte en Excel con Detalle y Resumen
   - `facturas_YYYYMMDD/` — PDFs originales

### 📋 Reglas de vencimiento (detalle)

La app expone un selector con tres modos, definido en `UploadPanel.js` y `ProcessingQueue.js`:

| Modo | Fecha Pago usada | Importe usado | Validación |
|---|---|---|---|
| **Automático** (`auto`) | La fecha de pago que elegiste para el lote | `importe1` si fecha pago ≤ 1er vto, sino `importe2` | Rechaza si la fecha de pago supera **ambos** vencimientos |
| **1er vencimiento** (`1`) | Se usa la fecha del 1er vto de **cada** comprobante | `importe1` (el del 1er vto) | No valida contra fecha de pago (se fuerza al 1er vto) |
| **2do vencimiento** (`2`) | Se usa la fecha del 2do vto de **cada** comprobante | `importe2` (el del 2do vto) | No valida contra fecha de pago (se fuerza al 2do vto) |

> Si ambos vencimientos tienen la misma fecha, se usa siempre `importe1` (no hay distinción).

En modo **Automático**, el importe se resuelve comprobante por comprobante comparando la fecha de pago contra el 1er vencimiento de cada factura. Esto permite mezclar comprobantes con distintos vencimientos en un mismo lote.

## 📊 Importación desde Excel

Además de PDFs y TXTs, podés importar un archivo Excel con los datos de los comprobantes. Descargá la **plantilla** desde el botón `Descargar plantilla Excel` en la pantalla principal.

### Columnas de la plantilla

| Columna | Formato | Ejemplo |
|---------|---------|---------|
| Nro Comprobante | Hasta 11 dígitos (se completa con ceros a la izquierda) | `00000192840` |
| Tipo | 2 dígitos (default `07`) | `07` |
| Fecha 1er Vto | DDMMAA | `040626` |
| Importe 1er Vto ($) | Pesos argentinos (la app convierte a centavos) | `120553,57` |
| Fecha 2do Vto | DDMMAA | `040626` |
| Importe 2do Vto ($) | Pesos argentinos | `120553,57` |

Por cada fila, la app **construye automáticamente** el código de barra de 50 dígitos:
- **Código de ente** — desde la configuración (ej. `0135` para Hurlingham)
- **Dígito verificador** — calculado con el algoritmo Formato 50
- **Importes** — convertidos de pesos a centavos

### Hoja "⚠️ Leer — Formato de campos"

La plantilla incluye una segunda hoja con la especificación completa de cada campo: posición en el código de barra, cantidad de dígitos, validaciones, y qué es autocalculado. Revisala si querés entender el formato o solucionar errores de importación.

### Ejemplo de uso

1. Descargá la plantilla (`Descargar plantilla Excel`)
2. Completá los datos de tus comprobantes (una fila por comprobante)
3. Subí el Excel a la app junto con otros PDFs si hac falta
4. La app genera el TXT de compensación integrando todo

> **Los campos autocalculados no se incluyen en el Excel.** El código de barra completo y el dígito verificador se generan automáticamente al importar.

## 🎨 Personalización

Para usar con otro municipio o entidad, editá `js/theme.js`:

```js
name: 'Hurlingham',  // Nombre del ente
code: '0135',         // Código de ente (4 dígitos)
colors: {
  primary: '#00ad9c',
  // ...paleta de colores
}
```

También reemplazá `assets/logo.png` y `assets/logo-white.png`.

## 📁 Estructura

```
compensation-app/
├── index.html                    ← Página principal
├── css/style.css                 ← Estilos (Pico CSS + overrides)
├── js/
│   ├── app.js                    ← Orquestador principal
│   ├── config.js                 ← Configuración operativa
│   ├── theme.js                  ← Tema (colores, logo, fuente)
│   ├── atoms/                    ← Componentes atómicos (Button, Badge, Icon)
│   ├── molecules/                ← Componentes moleculares (FileDropZone, DatePickerField)
│   ├── organisms/                ← Componentes organismo (UploadPanel, ProcessingQueue,
│   │                                ResultsTable, CompensationReport)
│   ├── services/                 ← Servicios (barcode-parser, check-digit,
│   │                                rafam-builder, pdf-extractor)
│   ├── utils/                    ← Utilidades (format)
│   └── __tests__/                ← Tests (Jest, 264 tests)
├── assets/
│   ├── logo.png                  ← Logo color
│   └── logo-white.png            ← Logo blanco
├── serve.py                      ← Servidor de desarrollo
├── serve.bat                     ← Acceso directo (doble click)
├── .gitignore
├── package.json
└── README.md
```

## 🧰 Stack

| Tecnología     | Uso                                       |
|----------------|-------------------------------------------|
| Pico CSS v2    | Framework CSS minimalista                 |
| DM Sans        | Tipografía Google Fonts                   |
| Lucide v0.468  | Iconos SVG                                |
| pdf.js v3      | Extracción de texto de PDFs (cliente)     |
| Zod v3         | Validación de esquemas en runtime         |
| Driver.js      | Tour interactivo de la interfaz           |
| JSZip v3       | Compresión ZIP                            |
| SheetJS (xlsx) | Generación de reporte Excel               |

## Desarrollo

### Stack de herramientas

| Herramienta | Uso                        |
|-------------|----------------------------|
| Jest        | Tests unitarios (264 tests) |
| ESLint      | Linter estricto (0 errores) |

### Commits recientes

- Lógica de selección de vencimiento (1ro / 2do / automático)
- Validación de fecha de pago contra vencimientos
- Reporte Excel con detalle y resumen
- Tour interactivo con Driver.js
- Traducción completa de la UI a español
- Fixtures sintéticos para tests (sin PDFs reales)
- Refinamientos de UI y branding

## 📄 Formato RAFAMR01

Cada registro tiene **279 caracteres de ancho fijo** con 40 campos. El código de barra de 50 dígitos se parsea en:

| Campo            | Posición | Dígitos | Descripción                          |
|------------------|----------|---------|--------------------------------------|
| Ente             | 0–3      | 4       | Código de ente (Hurlingham = `0135`) |
| Fecha 1er Vto    | 4–9      | 6       | DDMMAA — 1er vencimiento             |
| Importe 1er Vto  | 10–19    | 10      | Importe 1er vencimiento (en céntimos) |
| Fecha 2do Vto    | 20–25    | 6       | DDMMAA — 2do vencimiento             |
| Importe 2do Vto  | 26–35    | 10      | Importe 2do vencimiento (en céntimos) |
| Nro Comprobante  | 36–46    | 11      | Número de comprobante (Tipo 7)       |
| Tipo Comprobante | 47–48    | 2       | `"07"` para consolidación            |
| Dígito Verificador | 49     | 1       | Dígito verificador (0–9)             |
