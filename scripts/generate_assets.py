#!/usr/bin/env python3
"""Generate original, schematic exercise identifiers; never presented as coaching diagrams.
No network. No bundled fonts. All SVGs consist of project-authored geometric shapes.
"""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'web' / 'assets'
ASSETS.mkdir(parents=True, exist_ok=True)

def line(points, color='#28462b', width=8, opacity=1):
    pts=' '.join(f'{x},{y}' for x,y in points)
    return f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round" opacity="{opacity}"/>'

def rect(x,y,w,h,fill='#778d6b',r=3):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"/>'

def person(head, segments, accent='#325a32'):
    x,y=head
    result=f'<circle cx="{x}" cy="{y}" r="10" fill="#2a442a"/>'
    for i,pts in enumerate(segments):
        result+=line(pts,accent if i==0 else '#304f31',9 if i==0 else 7)
    return result

def db(x,y,angle=0):
    return f'<g transform="translate({x},{y}) rotate({angle})">{rect(-14,-4,28,8,"#344e31",2)}{rect(-16,-10,7,20,"#263c25",2)}{rect(9,-10,7,20,"#263c25",2)}</g>'

art={}
art['chest-press'] = rect(71,59,9,80)+rect(77,118,40,8)+line([(75,126),(66,153),(112,153)],'#96a688',4)+person((92,64), [[(90,81),(88,116)],[(90,89),(120,87),(146,81)],[(88,116),(117,118),(122,151)]])+line([(144,69),(144,99)],'#6e855e',5)+line([(67,151),(164,151)],'#a9b699',3)
art['lat-pulldown'] = line([(65,150),(65,29),(166,29),(166,151)],'#9faf92',5)+line([(89,34),(137,34)],'#465e37',6)+line([(113,29),(113,36)],'#70895b',2)+rect(83,123,48,7)+person((110,69), [[(110,85),(110,120)],[(109,90),(82,71),(89,40)],[(114,90),(139,71),(136,40)],[(110,120),(91,133),(89,151)],[(110,120),(129,132),(132,151)]])
art['seated-row'] = rect(43,125,72,8)+line([(111,93),(178,93)],'#7b906d',3)+rect(174,69,13,66)+person((80,65), [[(81,81),(81,119)],[(84,89),(109,103),(122,92)],[(81,119),(118,123),(153,146)]])+line([(142,139),(152,150)],'#708563',5)
art['leg-press'] = line([(49,96),(73,137),(109,141)],'#829974',9)+line([(109,141),(172,62)],'#9bad90',5)+line([(151,56),(174,77)],'#586f47',10)+person((64,82), [[(73,98),(92,120)],[(78,100),(97,124)],[(91,119),(118,102),(151,79)],[(92,121),(126,119),(156,84)]])
art['goblet-squat'] = person((113,54), [[(112,71),(101,104)],[(112,76),(89,78),(99,67)],[(113,75),(134,79),(122,67)],[(101,104),(76,119),(85,153)],[(102,104),(136,121),(145,153)]])+db(111,66,90)+line([(69,155),(152,155)],'#9daf90',3)
art['leg-curl'] = line([(59,63),(62,122),(136,122)],'#8c9b7a',8)+line([(83,129),(77,154),(152,154)],'#a1b18e',5)+person((78,56), [[(79,73),(83,111)],[(80,83),(103,114)],[(83,112),(130,112),(135,146)]])+rect(125,141,24,10,'#576e44',5)
art['shoulder-press'] = rect(87,120,50,7)+line([(98,127),(95,154),(138,154)],'#a1b08e',4)+person((111,61), [[(111,78),(111,118)],[(109,85),(84,69),(83,43)],[(114,85),(140,67),(140,43)],[(111,118),(88,128),(86,152)],[(111,118),(137,128),(139,152)]])+db(80,39)+db(143,39)
art['lateral-raise'] = person((110,48), [[(110,65),(110,111)],[(109,77),(80,78),(50,79)],[(113,77),(143,78),(169,79)],[(110,111),(94,151)],[(110,111),(128,151)]])+db(48,82,90)+db(174,82,90)+line([(62,106),(48,100),(45,88)],'#8ca26e',2,.8)+line([(157,107),(172,101),(175,88)],'#8ca26e',2,.8)
art['biceps-curl'] = person((112,46), [[(112,63),(111,109)],[(107,73),(83,96),(78,75)],[(117,73),(140,97),(145,75)],[(111,109),(95,151)],[(111,109),(131,151)]])+db(76,70)+db(149,70)
art['triceps-pushdown'] = line([(158,25),(174,25),(174,154)],'#96aa87',6)+line([(158,25),(156,114)],'#7f9572',2)+person((102,56), [[(105,73),(108,113)],[(107,80),(122,94),(148,123)],[(108,113),(90,151)],[(108,113),(129,150)]])+line([(144,126),(162,114)],'#3c5631',7)
art['glute-bridge'] = rect(31,150,163,4,'#97ad80',2)+person((52,138), [[(65,137),(105,111)],[(69,138),(95,142)],[(105,111),(140,110),(164,147)]])+line([(152,149),(179,149)],'#426038',6)
art['calf-raise'] = rect(97,146,59,11,'#8fa677',3)+person((113,41), [[(113,58),(112,104)],[(108,70),(91,96),(100,112)],[(117,70),(136,96),(128,111)],[(112,104),(113,137),(125,145)]] )+line([(72,131),(72,111)],'#94a87d',2)+line([(67,117),(72,110),(77,117)],'#94a87d',2)
art['push-up'] = rect(25,150,174,4,'#98ae82',2)+person((68,91), [[(82,97),(127,115)],[(82,99),(67,119),(65,147)],[(126,115),(173,140),(186,148)]])+line([(55,149),(75,149)],'#426039',5)
art['plank'] = rect(25,150,174,4,'#98ae82',2)+person((61,106), [[(76,111),(123,121)],[(78,114),(69,143),(44,146)],[(123,121),(166,142),(182,148)]])
art['reverse-lunge'] = person((109,49), [[(109,66),(106,106)],[(105,75),(90,91),(83,79)],[(113,76),(130,91),(139,79)],[(106,106),(75,117),(70,151)],[(106,106),(137,143),(166,150)]])+line([(58,153),(173,153)],'#9eaf8b',3)
art['dead-bug'] = rect(27,151,166,4,'#98ae82',2)+person((58,137), [[(72,138),(113,137)],[(81,138),(92,103),(104,79)],[(84,139),(51,115),(35,88)],[(113,137),(143,111),(168,132)],[(114,137),(155,146),(185,143)]])
for name,body in art.items():
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="440" height="340" viewBox="0 0 220 170" role="img"><title>{name} — schematic exercise identifier</title><rect width="220" height="170" rx="0" fill="#dce8c9"/><circle cx="115" cy="87" r="64" fill="#cddcba"/><path d="M26 155H194" stroke="#b0c39a" stroke-width="1"/>{body}<circle cx="186" cy="25" r="2" fill="#94aa7d"/></svg>'''
    (ASSETS/f'{name}.svg').write_text(svg,encoding='utf-8')
hero='''<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><circle cx="128" cy="128" r="102" fill="none" stroke="#2c421a" stroke-width="2"/><circle cx="128" cy="128" r="91" fill="none" stroke="#2c421a" stroke-width="1" stroke-dasharray="3 8"/><g transform="rotate(-30 128 128)" fill="#283e18"><rect x="67" y="116" width="122" height="24" rx="9"/><rect x="50" y="80" width="27" height="96" rx="9"/><rect x="32" y="96" width="15" height="64" rx="6"/><rect x="179" y="80" width="27" height="96" rx="9"/><rect x="209" y="96" width="15" height="64" rx="6"/></g><path d="m155 46 5-15 5 15 15 5-15 5-5 15-5-15-15-5Z" fill="#283e18"/><path d="m76 188 4-10 4 10 10 4-10 4-4 10-4-10-10-4Z" fill="#283e18"/></svg>'''
(ASSETS/'hero.svg').write_text(hero,encoding='utf-8')
icon='''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="120" fill="#c8f577"/><g fill="#203516" transform="rotate(-30 256 256)"><rect x="137" y="232" width="238" height="48" rx="16"/><rect x="99" y="167" width="53" height="178" rx="17"/><rect x="63" y="196" width="29" height="120" rx="10"/><rect x="359" y="167" width="53" height="178" rx="17"/><rect x="420" y="196" width="29" height="120" rx="10"/></g><path d="m340 97 8-25 8 25 25 8-25 8-8 25-8-25-25-8Z" fill="#203516"/></svg>'''
(ASSETS/'icon.svg').write_text(icon,encoding='utf-8')
try:
    import cairosvg
    for size in (192,512):
        cairosvg.svg2png(bytestring=icon.encode(),write_to=str(ASSETS/f'icon-{size}.png'),output_width=size,output_height=size)
except ImportError:
    print('Optional CairoSVG unavailable. Existing PNG icons, if present, are kept.')
print(f'Generated {len(art)} schematic exercise images + original app icons.')
