import json
import os
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "outputs" / "ace-rate-finder"
OUTPUT_FILE = OUTPUT_DIR / "ace-rate-finder-tax-vat-customs.xlsx"

SOURCES = {
    "Tax": Path("/private/tmp/ace-rate-finder-data.json"),
    "VAT": Path("/private/tmp/ace-vat-debug4.json"),
    "Customs": Path("/private/tmp/ace-customs-only.json"),
}

INVALID_XML_CHARS = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F]")


def xml(text):
    cleaned = INVALID_XML_CHARS.sub("", str(text if text is not None else ""))
    return escape(cleaned, {'"': "&quot;"})


def clean_text(text):
    return INVALID_XML_CHARS.sub("", str(text if text is not None else ""))


def col_name(index):
    name = ""
    while index:
        index, rem = divmod(index - 1, 26)
        name = chr(65 + rem) + name
    return name


def sheet_name(name):
    return re.sub(r"[\[\]:*?/\\]", " ", name)[:31]


def load_datasets():
    datasets = {}
    for key, source in SOURCES.items():
        payload = json.loads(source.read_text())
        for dataset in payload["datasets"]:
            if dataset["key"] == key:
                datasets[key] = dataset
    return datasets


def build_sheet_xml(headers, rows, title=None, source_url=None, shared_index=None):
    all_rows = []
    if title:
        all_rows.append([title])
        if source_url:
            all_rows.append(["Source", source_url])
        all_rows.append([])
    all_rows.append(headers)
    all_rows.extend(rows)

    header_row_number = len(all_rows) - len(rows)
    max_cols = max(len(row) for row in all_rows) if all_rows else 1
    max_rows = len(all_rows)
    dimension = f"A1:{col_name(max_cols)}{max_rows}"

    widths = []
    for col in range(max_cols):
        samples = [str(row[col]) for row in all_rows[:500] if col < len(row) and row[col] is not None]
        max_len = max([len(headers[col]) if col < len(headers) else 8, *[len(sample) for sample in samples]], default=10)
        widths.append(min(max(max_len + 3, 12), 56))

    parts = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
        f'<dimension ref="{dimension}"/>',
        '<sheetViews><sheetView workbookViewId="0">',
        f'<pane ySplit="{header_row_number}" topLeftCell="A{header_row_number + 1}" activePane="bottomLeft" state="frozen"/>',
        '</sheetView></sheetViews>',
        '<sheetFormatPr defaultRowHeight="18"/>',
        '<cols>',
    ]

    for idx, width in enumerate(widths, start=1):
        parts.append(f'<col min="{idx}" max="{idx}" width="{width}" customWidth="1"/>')
    parts.append("</cols><sheetData>")

    for row_idx, row in enumerate(all_rows, start=1):
        height = 28 if row_idx == 1 and title else 22
        parts.append(f'<row r="{row_idx}" ht="{height}" customHeight="1">')
        for col_idx in range(1, max_cols + 1):
            value = row[col_idx - 1] if col_idx <= len(row) else ""
            ref = f"{col_name(col_idx)}{row_idx}"
            style = 2
            if title and row_idx == 1:
                style = 3
            elif row_idx == header_row_number:
                style = 1
            if value is None or clean_text(value) == "":
                parts.append(f'<c r="{ref}" s="{style}"/>')
            else:
                string_id = shared_index(value)
                parts.append(f'<c r="{ref}" t="s" s="{style}"><v>{string_id}</v></c>')
        parts.append("</row>")

    parts.append("</sheetData>")
    filter_ref = f"A{header_row_number}:{col_name(max_cols)}{max_rows}"
    parts.append(f'<autoFilter ref="{filter_ref}"/>')
    parts.append("</worksheet>")
    return "".join(parts)


def workbook_xml(sheet_titles):
    sheets = []
    for idx, title in enumerate(sheet_titles, start=1):
        sheets.append(f'<sheet name="{xml(title)}" sheetId="{idx}" r:id="rId{idx}"/>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<bookViews><workbookView/></bookViews>'
        f'<sheets>{"".join(sheets)}</sheets>'
        '</workbook>'
    )


def workbook_rels(sheet_count):
    rels = []
    for idx in range(1, sheet_count + 1):
        rels.append(
            f'<Relationship Id="rId{idx}" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
            f'Target="worksheets/sheet{idx}.xml"/>'
        )
    rels.append(
        f'<Relationship Id="rId{sheet_count + 1}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
        'Target="styles.xml"/>'
    )
    rels.append(
        f'<Relationship Id="rId{sheet_count + 2}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" '
        'Target="sharedStrings.xml"/>'
    )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f'{"".join(rels)}</Relationships>'
    )


def content_types(sheet_count):
    overrides = [
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
        '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>',
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    ]
    for idx in range(1, sheet_count + 1):
        overrides.append(
            f'<Override PartName="/xl/worksheets/sheet{idx}.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        )
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        f'{"".join(overrides)}</Types>'
    )


def styles_xml():
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="4">'
        '<font><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
        '<font><sz val="11"/><name val="Calibri"/></font>'
        '<font><b/><sz val="16"/><color rgb="FF7F1D1D"/><name val="Calibri"/></font>'
        '</fonts>'
        '<fills count="4">'
        '<fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FF7F1D1D"/><bgColor indexed="64"/></patternFill></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF5F4"/><bgColor indexed="64"/></patternFill></fill>'
        '</fills>'
        '<borders count="2">'
        '<border><left/><right/><top/><bottom/><diagonal/></border>'
        '<border><left style="thin"><color rgb="FFE7CACA"/></left><right style="thin"><color rgb="FFE7CACA"/></right><top style="thin"><color rgb="FFE7CACA"/></top><bottom style="thin"><color rgb="FFE7CACA"/></bottom><diagonal/></border>'
        '</borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="4">'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
        '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
        '<xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>'
        '</cellXfs>'
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
        '</styleSheet>'
    )


def shared_strings_xml(strings, total_count):
    items = []
    for text in strings:
        items.append(f'<si><t xml:space="preserve">{xml(text)}</t></si>')
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{total_count}" uniqueCount="{len(strings)}">'
        f'{"".join(items)}</sst>'
    )


def root_rels():
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        '</Relationships>'
    )


def core_props(now):
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        '<dc:title>ACE Advisory Rate Finder Extract</dc:title>'
        '<dc:creator>BANIK Books</dc:creator>'
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>'
        f'<dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>'
        '</cp:coreProperties>'
    )


def app_props(sheet_titles):
    titles = "".join(f"<vt:lpstr>{xml(title)}</vt:lpstr>" for title in sheet_titles)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        '<Application>BANIK Books</Application>'
        '<HeadingPairs><vt:vector size="2" baseType="variant">'
        '<vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>'
        f'<vt:variant><vt:i4>{len(sheet_titles)}</vt:i4></vt:variant>'
        '</vt:vector></HeadingPairs>'
        f'<TitlesOfParts><vt:vector size="{len(sheet_titles)}" baseType="lpstr">{titles}</vt:vector></TitlesOfParts>'
        '</Properties>'
    )


def main():
    datasets = load_datasets()
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    shared_strings = []
    shared_lookup = {}
    shared_ref_count = 0

    def shared_index(value):
        nonlocal shared_ref_count
        value = clean_text(value)
        shared_ref_count += 1
        if value not in shared_lookup:
            shared_lookup[value] = len(shared_strings)
            shared_strings.append(value)
        return shared_lookup[value]

    sheets = []
    summary_rows = [
        ["Workbook", "ACE Advisory Rate Finder Extract"],
        ["Source", "https://aceadvisory.biz/tools/rate-finder"],
        ["Looker Studio Report", "https://lookerstudio.google.com/reporting/3eb142ce-553a-4a2d-9958-710f5dae2a67"],
        ["Extracted At", now],
        [],
        ["Sheet", "Rows", "Columns", "Source Page"],
    ]

    ordered = [
        ("Tax", "TDS TCS Rates"),
        ("VAT", "VAT VDS Rates"),
        ("Customs", "Customs Rates"),
    ]
    for key, display in ordered:
        dataset = datasets[key]
        headers = dataset["meta"]["headers"]
        rows = [row["cells"] for row in dataset["rows"]]
        summary_rows.append([display, len(rows), len(headers), dataset["sourceUrl"]])
        sheets.append({
            "name": sheet_name(display),
            "xml": build_sheet_xml(headers, rows, display, dataset["sourceUrl"], shared_index),
        })

    sheet_titles = ["Summary", *[sheet["name"] for sheet in sheets]]
    summary_xml = build_sheet_xml(["Field", "Value", "Extra", "Link"], summary_rows, "ACE Advisory Rate Finder Extract", None, shared_index)
    all_sheet_xml = [summary_xml, *[sheet["xml"] for sheet in sheets]]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUTPUT_FILE, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types(len(sheet_titles)))
        archive.writestr("_rels/.rels", root_rels())
        archive.writestr("docProps/core.xml", core_props(now))
        archive.writestr("docProps/app.xml", app_props(sheet_titles))
        archive.writestr("xl/workbook.xml", workbook_xml(sheet_titles))
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_rels(len(sheet_titles)))
        archive.writestr("xl/styles.xml", styles_xml())
        archive.writestr("xl/sharedStrings.xml", shared_strings_xml(shared_strings, shared_ref_count))
        for idx, xml_text in enumerate(all_sheet_xml, start=1):
            archive.writestr(f"xl/worksheets/sheet{idx}.xml", xml_text)

    print(OUTPUT_FILE)


if __name__ == "__main__":
    main()
