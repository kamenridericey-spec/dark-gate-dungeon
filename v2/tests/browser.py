"""当前界面回归入口。先在第二版目录启动 python -m http.server 3301。"""
from pathlib import Path
from runpy import run_path
run_path(str(Path(__file__).with_name('ui-regression-v083.py')),run_name='__main__')
