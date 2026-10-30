# 문제지 PDF를 문제 하나하나의 이미지로 자르고, 정답표와 합쳐서 기출 문제 데이터를 만들어요.
# 사용법: py tools/extract-questions.py source-pdf data
#   - 필요한 것: PyMuPDF (pip install pymupdf), pdftotext (Git for Windows 에 들어 있어요)
#   - 결과: data/past-exams.json, data/past-questions.json, data/past/<회차><s|b>/<번호>.webp
import json
import re
import shutil
import subprocess
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image, ImageOps

ZOOM = 2.2            # 휴대폰 화면 폭(약 700px)에 맞춘 확대 배율
WEBP_QUALITY = 78
LEVELS = {'심화': {'code': 's', 'choices': 5, 'minutes': 80}, '기본': {'code': 'b', 'choices': 4, 'minutes': 70}}
CIRCLED = '①②③④⑤'

# ── 시대 자동 분류 ─────────────────────────────────────────────
# 한능검 문제는 시대 순서대로 나와요. 문제마다 키워드 점수를 매긴 뒤,
# '앞 문제보다 이른 시대로 돌아가지 않는다'는 조건으로 가장 그럴듯한 시대를 골라요.
ERAS = ['선사', '고대', '고려', '조선', '근대', '일제 강점기', '현대']
THEME = '통합'
KEYWORDS = {
    '선사': '구석기|신석기|청동기|철기 시대|주먹도끼|빗살무늬|고인돌|막집|움집|뗀석기|간석기|가락바퀴|반달 돌칼|비파형 동검|민무늬 토기|슴베찌르개|덧무늬 토기',
    '고대': '고조선|위만|단군|범금 8조|부여|고구려|옥저|동예|삼한|마한|백제|신라|가야|발해|무령왕|광개토|장수왕|진흥왕|근초고왕|법흥왕|김유신|의자왕|신문왕|원효|의상|최치원|장보고|후백제|후고구려|견훤|궁예|골품|화백|상대등|무천|영고|책화|소도|대조영|해동성국|살수|안시성|황산벌|김춘추|문무왕|성왕|을지문덕|담로|사비|웅진|진대법|태학|국학|독서삼품과|녹읍|관료전|5소경|청해진|선덕 여왕|첨성대|석굴암|불국사',
    '고려': '고려|왕건|광종|거란|여진|몽골|삼별초|무신 정변|무신 정권|최충헌|최우|공민왕|묘청|서희|강감찬|윤관|별무반|팔만대장경|직지|의천|지눌|원 간섭기|권문세족|신진 사대부|위화도|홍건적|전시과|벽란도|교정도감|도병마사|쌍성총관부|정동행성|노비안검법|과거제|훈요 10조|만적|망이|무애|팔관회|이자겸|강화도 천도|처인성|귀주',
    '조선': '정도전|태종|세종|세조|경국대전|사림|훈구|사화|임진왜란|병자호란|정묘호란|광해군|인조|효종|숙종|영조|정조|탕평|균역법|대동법|규장각|실학|정약용|박지원|이황|이이|붕당|환국|세도 정치|홍경래|임술 농민|비변사|집현전|훈민정음|상평통보|한양|의금부|사간원|홍문관|향약|서원|조광조|이순신|한산도|행주|훈련도감|북벌|예송|천주교|서학|동학 창도|최제우|공명첩|모내기법|장시|탕평비|수원 화성|초계문신|신해통공|통신사|일본에 파견|4군 6진|계유정난|과전법',
    '근대': '흥선 대원군|병인양요|신미양요|양요|강화도 조약|조약|개화|개항|임오군란|갑신정변|동학 농민|갑오개혁|을미사변|을미개혁|아관 파천|독립 협회|대한 제국|광무|을사늑약|을사조약|의병|국채 보상|신민회|헤이그|통감부|애국 계몽|별기군|조사 시찰단|영선사|보빙사|만민 공동회|독립신문|황성신문|대한매일신보|전차|경인선|척화비|원산 학사|육영 공원|거문도|조·미 수호|조미 수호|한성순보|우정총국|전봉준|홍범 14조|단발령|군국기무처|고종|순종|안중근|이토 히로부미|한일 신협약|정미 7조약|기유각서|간도 협약|독도 편입|대한국 국제',
    '일제 강점기': '조선 총독부|총독부|무단 통치|문화 통치|민족 말살|토지 조사 사업|회사령|산미 증식|3·1 운동|대한민국 임시 정부|대한민국 임시정부|임시 정부|임시정부|의열단|한인 애국단|신간회|광주 학생|6·10 만세|물산 장려|민립 대학|청산리|봉오동|한국광복군|한국 광복군|조선 의용대|창씨개명|국가 총동원법|징용|징병|위안부|형평 운동|조선어 학회|윤봉길|이봉창|김원봉|치안 유지법|독립군|간도 참변|자유시|대한 독립군|북로 군정서|조선 혁명군|한국 독립군|태형령|헌병 경찰|황국 신민|신사 참배|근우회|조선 청년 독립단|2·8 독립|대한 광복회|독립 의군부|105인 사건|브나로드|진단 학회|조선사 편수회|국민 대표 회의|건국 강령|카이로',
    '현대': '민주화 운동|정부 시기|통일 노력|대통령|광복 직후|미 군정|미군정|모스크바|신탁 통치|좌우 합작|5·10 총선거|제헌 국회|반민족 행위|반민 특위|6·25 전쟁|6·25|정전 협정|휴전|이승만|4·19|5·16|박정희|유신|전두환|5·18|6월 민주 항쟁|노태우|김영삼|김대중|노무현|이명박|외환 위기|새마을 운동|경제 개발|7·4 남북|남북 기본 합의서|금융 실명제|서울 올림픽|장면 내각|4·13 호헌|6·29|부마|베트남 파병|한일 협정|한·일 협정|농지 개혁|발췌 개헌|사사오입|3·15 부정|10월 유신|긴급 조치|12·12|삼청 교육대|남북 정상 회담|6·15|10·4 남북|경부 고속|IMF|금 모으기|여운형|건국 준비 위원회|김구|남북 협상|제주 4·3|여수·순천|인천 상륙|흥남 철수|1·4 후퇴',
}
THEME_KEYWORDS = '세시 풍속|세시풍속|단오|한식날|정월 대보름|동짓날|동지 팥죽|추석|설날|독도|울릉도'
# 보기는 일부러 다른 시대 내용으로 만드는 경우가 많아서, 보기 글자는 약하게 셈해요.
CHOICE_WEIGHT = 0.3
# 시대마다 대략 나오는 문제 위치(전체 중 비율). 이 범위를 벗어난 만큼 점수를 깎아요.
BANDS = {
    '선사': (0.0, 0.04), '고대': (0.02, 0.21), '고려': (0.19, 0.35), '조선': (0.33, 0.56),
    '근대': (0.54, 0.72), '일제 강점기': (0.70, 0.86), '현대': (0.84, 1.0),
}
PRIOR_WEIGHT = 0.8  # 범위에서 문제 하나만큼 벗어날 때마다 깎는 점수
ANNIVERSARY_KEYWORDS = [
    ('03-01', '3·1 운동'), ('04-11', '임시 정부|임시정부'), ('04-19', '4·19'), ('05-18', '5·18'),
    ('06-10', '6월 민주 항쟁|6·10 만세'), ('06-25', '6·25'), ('07-17', '제헌'), ('08-15', '광복 직후|8·15 광복|광복 이후'),
    ('10-01', '국군의 날'), ('10-03', '단군|개천절|고조선'), ('10-09', '훈민정음|한글날'), ('11-03', '광주 학생'),
    ('11-17', '을사늑약|을사조약|순국선열'),
]


def year_era(year):
    if year < 918:
        return '고대'
    if year < 1392:
        return '고려'
    if year < 1863:
        return '조선'
    if year < 1910:
        return '근대'
    if year < 1945:
        return '일제 강점기'
    return '현대'


def clean(text):
    text = re.sub(r'[​-‏﻿]', '', text)
    text = re.sub(r'[‧ㆍ∙・]', '·', text)
    return re.sub(r'\s+', ' ', text).strip()


def keyword_scores(text, factor=1.0):
    scores = {era: 0.0 for era in ERAS}
    best = {}
    for era, words in KEYWORDS.items():
        for word in words.split('|'):
            n = text.count(word)
            if n:
                weight = 2 if len(word) >= 3 else 1
                scores[era] += min(n, 3) * weight * factor
                if weight * len(word) > best.get(era, ('', 0))[1]:
                    best[era] = (word, weight * len(word))
    # '조선'만 단독으로 나오면 약하게 (조선 총독부, 조선 의용대 등과 헷갈리지 않게)
    if re.search(r'조선(?! 총독부| 의용대|어 학회| 혁명| 청년| 건국|사 편수회)', text):
        scores['조선'] += 0.5 * factor
    for y in re.findall(r'(?<!\d)(1[0-9]{3}|[5-9][0-9]{2})년', text):
        scores[year_era(int(y))] += 3 * factor
    return scores, {era: word for era, (word, _) in best.items()}


def era_scores(item):
    main, main_best = keyword_scores(item['main'])
    extra, choice_best = keyword_scores(item['choices'], CHOICE_WEIGHT)
    return {era: main[era] + extra[era] for era in ERAS}, {**choice_best, **main_best}


def assign_eras(items):
    """문제 순서를 따라 시대가 거꾸로 가지 않도록 점수 합이 가장 큰 배치를 찾아요."""
    infos = [era_scores(it) for it in items]
    texts = [it['main'] for it in items]
    last = max(len(items) - 1, 1)
    for i, (sc, _) in enumerate(infos):
        f = i / last
        for era, (lo, hi) in BANDS.items():
            sc[era] -= PRIOR_WEIGHT * max(0.0, lo - f, f - hi) * last
    # 세시 풍속·독도 문제, 그리고 끝부분의 '○○ 지역' 탐구 문제는 여러 시대를 묶은 통합 문제예요.
    theme = [bool(re.search(THEME_KEYWORDS, it['main'])) or ('지역' in it['stem'] and i / last >= 0.9)
             for i, it in enumerate(items)]
    idx = [i for i in range(len(texts)) if not theme[i]]
    n, k = len(idx), len(ERAS)
    dp = [[0.0] * k for _ in range(n)]
    back = [[0] * k for _ in range(n)]
    for j, i in enumerate(idx):
        sc = infos[i][0]
        for e in range(k):
            if j == 0:
                dp[j][e] = sc[ERAS[e]] - e * 0.01
                continue
            prev = max(range(e + 1), key=lambda p: (dp[j - 1][p], p))
            dp[j][e] = dp[j - 1][prev] + sc[ERAS[e]]
            back[j][e] = prev
    result = [THEME] * len(texts)
    if n:
        e = max(range(k), key=lambda x: (dp[n - 1][x], -x))
        for j in range(n - 1, -1, -1):
            result[idx[j]] = ERAS[e]
            e = back[j][e]
    topics = []
    for i, era in enumerate(result):
        found = infos[i][1]
        topics.append(found.get(era) or (max(found.values(), key=len) if found else ''))
    return result, topics


def anniversary_of(text):
    for date, words in ANNIVERSARY_KEYWORDS:
        if re.search(words, text):
            return date
    return None


# ── 정답표 ─────────────────────────────────────────────────────
def read_answers(pdf):
    exe = shutil.which('pdftotext')
    if not exe:
        sys.exit('pdftotext 를 찾을 수 없어요. Git Bash 에서 실행해 주세요.')
    out = subprocess.run([exe, '-enc', 'UTF-8', '-layout', str(pdf), '-'], capture_output=True, check=True).stdout.decode('utf-8')
    answers = {}
    for no, mark, points in re.findall(r'(?<!\d)(\d{1,2})\s+([①②③④⑤]|없음)\s+([1-3])(?!\d)', out):
        # '없음' = 이의 심사로 정답 없음(전원 정답) 처리된 문항이에요. 0으로 둬요.
        answers[int(no)] = (0 if mark == '없음' else CIRCLED.index(mark) + 1, int(points))
    if len(answers) < 50:
        answers = read_plain_answers(out) or answers
    return answers


def read_plain_answers(out):
    """정답이 ①이 아니라 숫자로 적힌 표(58·73회). 줄마다 r, r+10, … r+40번이 차례로 있어요.
    첫 칸은 '12  1'처럼 번호와 정답이 붙어 나와서, 번호를 알고 차례로 찾아요."""
    answers = {}
    rows = [line for line in out.splitlines() if re.match(r'^\s*\d', line)]
    for r, line in enumerate(rows[:10], start=1):
        pos = 0
        for no in range(r, 51, 10):
            m = re.compile(rf'(?<!\d){no}\s*([1-5])\s+([1-3])(?!\d)').search(line, pos)
            if not m:
                return None
            answers[no] = (int(m.group(1)), int(m.group(2)))
            pos = m.end()
    return answers if len(answers) == 50 else None


# ── 문제지 자르기 ──────────────────────────────────────────────
# 문항 번호는 단 왼쪽 끝 좁은 띠에만 찍혀 있어요. 그 띠의 잉크 덩어리로 번호 위치를 찾아요.
# 글자가 없는 스캔본도 같은 방법으로 자르고, 글자는 Windows OCR(tools/ocr.ps1)로 읽어요.
INK = 140


def render(page):
    pix = page.get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), alpha=False)
    return Image.frombytes('RGB', (pix.width, pix.height), pix.samples)


def rules(mask, frac=0.85):
    """가로로 길게 그은 줄(머리·꼬리 구분선)이 있는 y 목록"""
    return np.nonzero(mask.sum(1) > mask.shape[1] * frac)[0]


def page_layout(mask):
    h, w = mask.shape
    lines = rules(mask)
    top = max([y for y in lines if y < h * 0.2], default=int(h * 0.06)) + 4
    bottom = min([y for y in lines if y > h * 0.85], default=int(h * 0.94)) - 4
    body = mask[top:bottom]
    counts = body.sum(0)
    tall = counts > (bottom - top) * 0.5          # 세로 구분선은 빼요
    lefts, divider = [], w // 2
    if tall[int(w * 0.4):int(w * 0.6)].any():
        divider = int(w * 0.4) + int(np.nonzero(tall[int(w * 0.4):int(w * 0.6)])[0].mean())
    for lo, hi in ((int(w * 0.02), divider - 4), (divider + 4, int(w * 0.98))):
        xs = [x for x in range(lo, hi) if counts[x] >= 12 and not tall[x]]
        lefts.append(xs[0] if xs else None)
    return top, bottom, divider, lefts


def find_markers(mask, top, bottom, left):
    h, w = mask.shape
    strip = mask[top:bottom, max(0, left - 3):left + int(w * 0.011)].any(1)
    runs, y = [], 0
    while y < len(strip):
        if strip[y]:
            s = y
            while y < len(strip) and (strip[y] or strip[min(y + 1, len(strip) - 1)] or strip[min(y + 2, len(strip) - 1)]):
                y += 1
            runs.append((top + s, y - s))
        y += 1
    return [s for s, n in runs if h * 0.006 <= n <= h * 0.02]


def page_has_text(page):
    return len(page.get_text().strip()) > 200


def run_ocr(ocr_dir):
    if any(ocr_dir.glob('*.png')):
        subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
                        str(Path(__file__).with_name('ocr.ps1')), str(ocr_dir)], check=True)


def ocr_lines(ocr_dir, pno):
    f = ocr_dir / f'p{pno:02d}.json'
    if not f.exists():
        return None
    out = []
    for line in json.loads(f.read_text(encoding='utf-8-sig'))['lines']:
        w = line['words'][0]
        out.append({'x': w['x'], 'y': w['y'], 'first': w['t'], 'text': clean(line['text'])})
    return out


def number_at(lines, left, y, w):
    """번호 자리에서 읽힌 글자: 번호면 그 숫자, 다른 글자면 'bad', 아무것도 없으면 None"""
    near = [l for l in lines if abs(l['y'] - y) <= 14 and abs(l['x'] - left) <= w * 0.012]
    for l in near:
        m = re.match(r'^([1-9]\d?)\s*[.,]', l['first'] + ' ')
        if m and int(m.group(1)) <= 50:
            return int(m.group(1))
    # 숫자로 시작하지만 번호 모양이 아니면(예: '12.'를 '2'로 읽음) 못 읽은 것으로 봐요.
    return 'bad' if near and not any(re.match(r'^\d', l['first']) for l in near) else None


def pick_markers(cands, total=50):
    """OCR로 읽힌 번호를 기준점으로, 기준점 사이에 빠진 개수만큼만 못 읽은 후보를 받아요."""
    cands = [c for c in cands if c['value'] != 'bad']
    anchors, last = [], 0
    for i, c in enumerate(cands):
        if isinstance(c['value'], int) and c['value'] > last:
            anchors.append(i)
            last = c['value']
        elif isinstance(c['value'], int):
            c['value'] = None
    picked, prev_i, prev_v = [], -1, 0
    for i in anchors + [len(cands)]:
        v = cands[i]['value'] if i < len(cands) else total + 1
        unknown = [c for c in cands[prev_i + 1:i] if c['value'] is None]
        picked += unknown[:v - prev_v - 1]
        if i < len(cands):
            picked.append(cands[i])
        prev_i, prev_v = i, v
    return picked


def fix_layout(layouts, pno):
    """그림 때문에 단 위치를 잘못 잡은 쪽은, 같은 홀짝 쪽들의 가운데값으로 바로잡아요(홀짝 쪽은 여백이 달라요)."""
    top, bottom, divider, lefts = layouts[pno]
    same = [l for i, l in enumerate(layouts) if i % 2 == pno % 2 and i > 0] or layouts
    med = lambda vals: int(np.median([v for v in vals if v is not None]))
    fixed = lambda v, m: m if v is None or abs(v - m) > 15 else v
    divider = fixed(divider, med([l[2] for l in same]))
    lefts = [fixed(lefts[c], med([l[3][c] for l in same])) for c in (0, 1)]
    return top, bottom, divider, lefts


def cut_questions(pdf, out_dir, ocr_dir):
    doc = pymupdf.open(pdf)
    pages = []
    for pno, page in enumerate(doc):
        img = render(page)
        if not page_has_text(page):
            png = ocr_dir / f'p{pno:02d}.png'
            if not png.with_suffix('.json').exists():
                img.save(png)
        pages.append(img)
    run_ocr(ocr_dir)
    masks = [np.asarray(img.convert('L')) < INK for img in pages]
    layouts = [page_layout(m) for m in masks]
    cands, headers = [], []
    for pno, img in enumerate(pages):
        top, bottom, divider, lefts = fix_layout(layouts, pno)
        lines = ocr_lines(ocr_dir, pno)
        if lines is None:  # 글자가 있는 PDF는 PDF 글자로 번호를 확인해요.
            lines = [{'x': w[0] * ZOOM, 'y': w[1] * ZOOM, 'first': w[4], 'text': w[4]} for w in doc[pno].get_text('words')]
        for col, left in enumerate(lefts):
            if left is None:
                continue
            x0 = max(0, left - 8)
            col_w = divider - 3 - max(0, (lefts[0] or 0) - 8)  # 오른쪽 단도 왼쪽 단과 폭이 같아요
            x1 = (divider - 3) if col == 0 else min(img.width, x0 + col_w)
            for y in find_markers(masks[pno], top, bottom, left):
                cands.append({'pno': pno, 'col': col, 'y': y, 'x0': x0, 'x1': x1, 'top': top, 'bottom': bottom,
                              'value': number_at(lines, left, y, img.width)})
            # '[47~48] 다음 자료를 보고…' 같은 두 문항 공통 자료의 머리글
            for l in lines:
                m = re.match(r'^\[\s*(\d{1,2})', l['first'])
                if m and abs(l['x'] - left) <= img.width * 0.012:
                    headers.append({'pno': pno, 'col': col, 'y': l['y'], 'first': int(m.group(1))})
    picked = pick_markers(cands)
    ends = []
    for i, c in enumerate(picked):
        nxt = picked[i + 1] if i + 1 < len(picked) else None
        ends.append(nxt['y'] - 6 if nxt and (nxt['pno'], nxt['col']) == (c['pno'], c['col']) else c['bottom'])
    # 공통 자료는 따로 잘라 두 문항에 함께 붙이고, 앞 문항 끝에 붙지 않게 잘라 내요.
    shared = {}
    for h in headers:
        a = h['first']
        if not 2 <= a <= len(picked) - 1:
            continue
        c = picked[a - 1]
        if (c['pno'], c['col']) != (h['pno'], h['col']) or not h['y'] < c['y']:
            print(f'⚠️  {pdf.name}: [{a}~{a + 1}] 공통 자료가 문항과 다른 단·쪽에 있어요')
            continue
        prev = picked[a - 2]
        if (prev['pno'], prev['col']) == (h['pno'], h['col']) and ends[a - 2] > h['y']:
            ends[a - 2] = h['y'] - 6
        img = pages[h['pno']]
        crop = trim_vertical(img.crop((c['x0'], max(c['top'], h['y'] - 8), c['x1'], c['y'] - 6)))
        path = out_dir / f'{a:02d}-{a + 1:02d}.webp'
        crop.save(path, 'WEBP', quality=WEBP_QUALITY, method=6)
        shared[a] = shared[a + 1] = (path, crop.size)
    marks = []
    for i, c in enumerate(picked):
        lines = ocr_lines(ocr_dir, c['pno'])
        marks.append((c['pno'], (c['x0'], max(c['top'], c['y'] - 8), c['x1'], ends[i]), pages[c['pno']], lines))
    items = []
    for no, (pno, box, img, lines) in enumerate(marks, start=1):
        crop = trim_vertical(img.crop(box))
        path = out_dir / f'{no:02d}.webp'
        crop.save(path, 'WEBP', quality=WEBP_QUALITY, method=6)
        item = {'no': no, 'path': path, 'size': crop.size, 'shared': shared.get(no)}
        if lines is None:
            page = doc[pno]
            rect = pymupdf.Rect(*(v / ZOOM for v in box))
            item['main'], item['choices'] = split_text(page, rect)
            item['stem'] = stem_of(page, rect)
            item['text'] = clean(page.get_text('text', clip=rect))
        else:
            inside = [l['text'] for l in lines if box[0] - 4 <= l['x'] <= box[2] and box[1] - 4 <= l['y'] < box[3]]
            text = ' '.join(inside)
            stem = re.sub(r'^\d{1,2}\s*[.,]\s*', '', ' '.join(inside[:2]))
            item.update(text=text, main=text, choices='', stem=re.sub(r'\s*\[[^\]]*\].*$', '', stem).strip())
        items.append(item)
    return items



def stem_of(page, rect):
    """번호 줄부터 [N점]이 나오는 줄까지가 문제 문장이에요."""
    words = sorted(page.get_text('words', clip=rect), key=lambda w: (w[1], w[0]))
    lines = []
    for w in words:
        if lines and abs(lines[-1][0] - w[1]) < 4:
            lines[-1][1].append(w)
        else:
            lines.append((w[1], [w]))
    picked = []
    for _, line in lines[:3]:
        picked.append(' '.join(w[4] for w in sorted(line, key=lambda w: w[0])))
        if '점]' in picked[-1]:
            break
    stem = clean(' '.join(picked))
    stem = re.sub(r'^\d{1,2}\.\s*', '', stem)
    return re.sub(r'\s*\[[1-3]점\].*$', '', stem).strip()


def split_text(page, rect):
    """보기(①~⑤로 시작하는 글)와 나머지(문제·자료)를 나눠요."""
    main, choices = [], []
    for b in page.get_text('blocks', clip=rect):
        if b[6] != 0:
            continue
        text = clean(b[4])
        (choices if re.match(r'^[①②③④⑤]', text) else main).append(text)
    return ' '.join(main), ' '.join(choices)


def trim_vertical(img, pad=14):
    ink = ImageOps.invert(img.convert('L')).point(lambda v: 255 if v > 24 else 0).getbbox()
    if not ink:
        return img
    return img.crop((0, max(0, ink[1] - pad), img.width, min(img.height, ink[3] + pad)))



def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'source-pdf')
    data = Path(sys.argv[2] if len(sys.argv) > 2 else 'data')
    index = json.loads((src / 'index.json').read_text(encoding='utf-8'))
    exams, questions, problems = [], [], []
    only = sys.argv[3].split(',') if len(sys.argv) > 3 else None  # 예: 60s,80s 만 다시 만들기
    for exam in sorted(index, key=lambda e: (-e['round'], e['level'] != '심화')):
        level = LEVELS[exam['level']]
        exam_id = f'{exam["round"]}{level["code"]}'
        if only and exam_id not in only:
            continue
        if 'questions' not in exam['files'] or 'answers' not in exam['files']:
            problems.append(f'{exam_id}: 파일이 모자라요')
            continue
        out_dir = data / 'past' / exam_id
        out_dir.mkdir(parents=True, exist_ok=True)
        answers = read_answers(src / exam['files']['answers'])
        ocr_dir = data / 'past-ocr' / exam_id
        ocr_dir.mkdir(parents=True, exist_ok=True)
        items = cut_questions(src / exam['files']['questions'], out_dir, ocr_dir)
        eras, topics = assign_eras(items)
        total_points = 0
        for it, era, topic in zip(items, eras, topics):
            no = it['no']
            if no not in answers:
                problems.append(f'{exam_id} {no}번: 정답이 없어요')
                continue
            answer, points = answers[no]
            mark = re.search(r'\[([1-3])점\]', it['text'])
            if mark and int(mark.group(1)) != points:
                problems.append(f'{exam_id} {no}번: 문제지 배점({mark.group(1)})과 정답표 배점({points})이 달라요')
            q = {
                'id': f'{exam_id}-{no:02d}',
                'exam': exam_id,
                'round': exam['round'],
                'level': exam['level'],
                'no': no,
                'era': era,
                'topic': topic,
                'points': points,
                'answer': answer,
                'choiceCount': level['choices'],
                'image': it['path'].relative_to(data.parent).as_posix(),
                'width': it['size'][0],
                'height': it['size'][1],
                **({'shared': it['shared'][0].relative_to(data.parent).as_posix(),
                    'sharedWidth': it['shared'][1][0], 'sharedHeight': it['shared'][1][1]} if it.get('shared') else {}),
                'stem': it['stem'][:160],
                'text': it['text'],
                'source': f'제{exam["round"]}회 {exam["level"]} {no}번',
            }
            anniv = anniversary_of(it['main'])
            if anniv:
                q['anniversary'] = anniv
            questions.append(q)
            total_points += points
        if len(items) != 50 or len(answers) != 50 or total_points != 100:
            problems.append(f'{exam_id}: 문제 {len(items)}개, 정답 {len(answers)}개, 배점 합 {total_points}점')
        exams.append({
            'id': exam_id, 'round': exam['round'], 'level': exam['level'], 'date': exam.get('date', ''),
            'count': len(items), 'minutes': level['minutes'], 'choiceCount': level['choices'],
        })
        print(f'{exam_id}: 문제 {len(items)}개 · 배점 합 {total_points} · 시대 {dict(Counter(eras))}')
    (data / 'past-exams.json').write_text(json.dumps(exams, ensure_ascii=False, indent=1), encoding='utf-8')
    # 앱에는 가벼운 목록만 올리고, OCR 글자 전체는 해설 쓰기용으로 past-ocr에 따로 둬요(공개 안 함).
    (data / 'past-ocr' / 'past-text.json').write_text(json.dumps({q['id']: q['text'] for q in questions}, ensure_ascii=False), encoding='utf-8')
    slim = [{k: v for k, v in q.items() if k not in ('text', 'level', 'choiceCount')} for q in questions]
    (data / 'past-questions.json').write_text(json.dumps(slim, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'\n시험 {len(exams)}개 · 문제 {len(questions)}개')
    for p in problems:
        print('⚠️ ', p)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
