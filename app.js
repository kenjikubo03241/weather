from flask import Flask, render_template
import json
import urllib.request
import re
from bs4 import BeautifulSoup as bs

app = Flask(__name__)

# 複数の市区町村コードをリストで指定
CLASS_AREA_CODES = ["2810000", "2820100", "2820200", "2820300", "2820400", "2820500", "2820600", "2820700", "2820800", "2820900", "2821000", "2821200", "2821300", "2821400", "2821500", "2821600", "2821700", "2821800", "2821900", "2822000", "2822100", "2822200", "2822300", "2822400", "2822500", "2822600", "2822700", "2822800", "2822900", "2830100", "2836500", "2838100", "2838200", "2844200", "2844300", "2844600", "2846400", "2848100", "2850100", "2858500", "2858600"]  # 例として神戸市、姫路市、尼崎市、加古川市

AREA_URL = "https://www.jma.go.jp/bosai/common/const/area.json"
warning_info_url = "https://www.jma.go.jp/bosai/warning/#area_type=class20s&area_code=%s&lang=ja"
url = "https://www.jma.go.jp/bosai/warning/data/warning/%s.json"

def warnings():
    # 警報・注意報情報を取得する関数
    trans_warning = {}
    
    # 警報内容の取得（最初のURL）
    warnings_soup = bs(urllib.request.urlopen(warning_info_url % CLASS_AREA_CODES[0]).read(), 'html.parser')
    warnings_contents = warnings_soup.find_all('script')[10]
    warnings_text_list = str(warnings_contents).split("},")
    warnings_list = [re.findall(r'\w+', warning) for warning in warnings_text_list if ':{name1:"' in warning]
    
    for warning_datas in warnings_list:
        warning_text = ''
        for warning_data in warning_datas:
            if warning_data in 'elem':
                break
            if warning_data in ['c', 'name1', 'name2']:
                continue
            if warning_data.isdecimal():
                warning_code = warning_data
                continue
            warning_text += '\\' + warning_data
        trans_warning[warning_code] = warning_text.encode('ascii').decode('unicode-escape')

    # 複数の市区町村の警報情報を取得
    area_data = urllib.request.urlopen(url=AREA_URL)
    area_data = json.loads(area_data.read())
    
    city_warning_texts = []
    
    for city_code in CLASS_AREA_CODES:
        area = area_data["class20s"][city_code]["name"]
        class15s_area_code = area_data['class20s'][city_code]['parent']
        class10s_area_code = area_data['class15s'][class15s_area_code]['parent']
        offices_area_code = area_data['class10s'][class10s_area_code]['parent']
        
        # 警報情報を取得
        warning_info = urllib.request.urlopen(url=url % (offices_area_code))
        warning_info = json.loads(warning_info.read())
        
        # 警報コードを取得
        warning_codes = [warning["code"]
                         for class_area in warning_info["areaTypes"][1]["areas"]
                         if class_area["code"] == city_code
                         for warning in class_area["warnings"]
                         if warning["status"] != "解除" and warning["status"] != "発表警報・注意報はなし"]
        
        # 警報テキストを取得
        warning_texts = [trans_warning[code] for code in warning_codes]
        
        city_warning_texts.append({
            'area': area,
            'warnings': warning_texts
        })
    
    return city_warning_texts

@app.route('/')
def index():
    city_warning_texts = warnings()
    return render_template('index.html', city_warning_texts=city_warning_texts)

if __name__ == '__main__':
    app.run(debug=True)
