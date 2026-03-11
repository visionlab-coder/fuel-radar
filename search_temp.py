import sys
sys.path.append(r'C:\Users\seowo\Documents\skills\skillsmp-search')
import os
import json
from scripts.skillsmp_search import keyword_search, ai_search

os.environ['SKILLSMP_API_KEY'] = 'sk_live_skillsmp_Q0y9IRJMCQO8l-c9DMZrUr_GIokbRn5sEyfJYdlBo68'

res_ai = ai_search("Best framework and skills for ultra-premium dark mode tactical dashboard UI UX with glassmorphism")
with open('search_results_ai.json', 'w', encoding='utf-8') as f:
    json.dump(res_ai, f, ensure_ascii=False, indent=2)

res_kw = keyword_search("UI UX", page=1, limit=5, sort_by="stars")
with open('search_results_kw.json', 'w', encoding='utf-8') as f:
    json.dump(res_kw, f, ensure_ascii=False, indent=2)

print("Search completed. JSON saved to workspace.")
