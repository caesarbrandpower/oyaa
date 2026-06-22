"""
Voegt Tungsten font embedding toe aan een bestaande PPTX.
Font embedding in OOXML werkt via:
- ppt/fonts/ map met de font binaries
- <p:embeddedFontLst> in presentation.xml met verwijzingen
- Relationships in presentation.xml.rels
"""
import zipfile, shutil, os, sys
from fontTools.ttLib import TTFont
from lxml import etree

FONTS = {
    'Tungsten Bold': { 'regular': 'public/fonts/Tungsten-Bold.otf' },
    'Tungsten Book': { 'regular': 'public/fonts/Tungsten-Book.otf' },
    'Tungsten SemiBold': { 'regular': 'public/fonts/Tungsten-Semibold.otf' },
}

def otf_to_embedding_bytes(otf_path):
    with open(otf_path, 'rb') as f:
        return f.read()

def embed_fonts_in_pptx(input_pptx, output_pptx, fonts):
    shutil.copy(input_pptx, output_pptx)

    P_NS   = 'http://schemas.openxmlformats.org/presentationml/2006/main'
    A_NS   = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
    CT_NS  = 'http://schemas.openxmlformats.org/package/2006/content-types'
    FONT_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font'
    CT_FONT = 'application/x-fontdata'

    with zipfile.ZipFile(output_pptx, 'r') as zin:
        files = {name: zin.read(name) for name in zin.namelist()}

    prs_tree  = etree.fromstring(files['ppt/presentation.xml'])
    rels_tree = etree.fromstring(files['ppt/_rels/presentation.xml.rels'])
    ct_tree   = etree.fromstring(files['[Content_Types].xml'])

    existing_defaults = {e.get('Extension') for e in ct_tree.findall(f'{{{CT_NS}}}Default')}

    font_lst = prs_tree.find(f'{{{P_NS}}}embeddedFontLst')
    if font_lst is None:
        font_lst = etree.SubElement(prs_tree, f'{{{P_NS}}}embeddedFontLst')

    rel_id_counter = 100

    variant_tags = {
        'regular':    'regular',
        'bold':       'bold',
        'italic':     'italic',
        'boldItalic': 'boldItalic',
    }

    for font_name, variants in fonts.items():
        font_el  = etree.SubElement(font_lst, f'{{{P_NS}}}embeddedFont')
        font_def = etree.SubElement(font_el, f'{{{A_NS}}}font')
        font_def.set('typeface', font_name)
        font_def.set('charset', '0')

        for variant_key, otf_path in variants.items():
            if not os.path.exists(otf_path):
                print(f'⚠️  Font niet gevonden: {otf_path}', file=sys.stderr)
                continue

            rel_id = f'rFontId{rel_id_counter}'
            rel_id_counter += 1

            font_bytes    = otf_to_embedding_bytes(otf_path)
            font_filename = f'font{rel_id_counter}.odttf'
            font_path_in_zip = f'ppt/fonts/{font_filename}'
            files[font_path_in_zip] = font_bytes

            rel_el = etree.SubElement(rels_tree, 'Relationship')
            rel_el.set('Id',     rel_id)
            rel_el.set('Type',   FONT_REL_TYPE)
            rel_el.set('Target', f'fonts/{font_filename}')

            tag        = variant_tags.get(variant_key, 'regular')
            variant_el = etree.SubElement(font_el, f'{{{P_NS}}}{tag}')
            variant_el.set(f'{{{REL_NS}}}id', rel_id)

            if 'odttf' not in existing_defaults:
                ct_el = etree.SubElement(ct_tree, f'{{{CT_NS}}}Default')
                ct_el.set('Extension',   'odttf')
                ct_el.set('ContentType', CT_FONT)
                existing_defaults.add('odttf')

    files['ppt/presentation.xml'] = etree.tostring(
        prs_tree, xml_declaration=True, encoding='UTF-8', standalone=True)
    files['ppt/_rels/presentation.xml.rels'] = etree.tostring(
        rels_tree, xml_declaration=True, encoding='UTF-8', standalone=True)
    files['[Content_Types].xml'] = etree.tostring(
        ct_tree, xml_declaration=True, encoding='UTF-8', standalone=True)

    with zipfile.ZipFile(output_pptx, 'w', zipfile.ZIP_DEFLATED) as zout:
        for name, data in files.items():
            zout.writestr(name, data)

    print(f'✅ Fonts embedded: {output_pptx}')
    return output_pptx


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Gebruik: python3 lib/embed-fonts.py <input.pptx> <output.pptx>', file=sys.stderr)
        sys.exit(1)
    embed_fonts_in_pptx(sys.argv[1], sys.argv[2], FONTS)
