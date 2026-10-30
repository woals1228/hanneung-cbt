# 한국사능력검정시험 시험 자료실에서 문제지·정답표 PDF를 내려받아요.
# 사용법: py tools/fetch-exams.py source-pdf
# 이미 받은 파일은 건너뛰고, 사이트에 부담이 가지 않게 요청 사이에 잠깐씩 쉬어요.
import http.cookiejar
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = 'https://www.historyexam.go.kr'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
PAUSE_SEC = 1.5

out = Path(sys.argv[1] if len(sys.argv) > 1 else 'source-pdf')
out.mkdir(parents=True, exist_ok=True)

opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
opener.addheaders = [('User-Agent', UA)]


def fetch(url, data=None):
    body = urllib.parse.urlencode(data).encode() if data else None
    with opener.open(url, body, timeout=120) as res:
        return res.read()


# 1) 목록에서 게시글 번호와 제목 모으기
posts = {}
for page in range(1, 20):
    html = fetch(f'{BASE}/pst/list.do?bbs=dat&pageIndex={page}').decode('utf-8', 'replace')
    found = re.findall(r"fn_goDetail\('(\d+)','BBS0003'\);\">\s*([^<]+)</a>\s*</td>\s*<td[^>]*>\s*([\d-]*)", html)
    fresh = [(sno, (title.strip(), date)) for sno, title, date in found if sno not in posts]
    if not fresh:
        break
    posts.update(fresh)
    time.sleep(PAUSE_SEC)
print(f'게시글 {len(posts)}개')

# 2) 게시글마다 첨부 파일 찾아서 받기 (등록일 = 시험일)
index = []
for sno, (title, date) in posts.items():
    m = re.search(r'제(\d+)회 한국사능력검정시험 (심화|기본)', title)
    if not m:
        print(f'건너뜀: {title}')
        continue
    round_no, level = int(m.group(1)), m.group(2)
    html = fetch(f'{BASE}/pst/view.do?bbs=dat', {'pst_sno': sno}).decode('utf-8', 'replace')
    time.sleep(PAUSE_SEC)
    entry = {'round': round_no, 'level': level, 'date': date, 'title': title, 'sno': sno, 'files': {}}
    for file_id, name in re.findall(r"fnFileDownload\('([^']+)'\)\">\s*([^<&]+)", html):
        kind = 'answers' if '답' in name or '정답' in name else 'questions'
        target = out / f'{round_no}-{level}-{"정답표" if kind == "answers" else "문제지"}.pdf'
        entry['files'][kind] = target.name
        if target.exists() and target.stat().st_size > 1000:
            continue
        body = fetch(f'{BASE}/atchFile/FileDown.do?atch_file_id={urllib.parse.quote(file_id)}')
        if not body.startswith(b'%PDF'):
            print(f'PDF가 아니에요: {title} / {name.strip()}')
            continue
        target.write_bytes(body)
        print(f'받음: {target.name} ({len(body) // 1024:,} KB)')
        time.sleep(PAUSE_SEC)
    index.append(entry)

index.sort(key=lambda e: (e['round'], e['level']))
(out / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'완료: 시험 {len(index)}개 → {out / "index.json"}')
