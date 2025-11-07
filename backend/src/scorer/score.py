#!/usr/bin/env python3
import sys, json, re

def tokenize(s: str):
    s = s.lower()
    s = re.sub(r"[^a-z0-9\s']+", " ", s)
    tokens = [t for t in s.split() if t]
    return tokens

def levenshtein_alignment(ref_tokens, hyp_tokens):
    n, m = len(ref_tokens), len(hyp_tokens)
    dp = [[0]*(m+1) for _ in range(n+1)]
    for i in range(n+1): dp[i][0] = i
    for j in range(m+1): dp[0][j] = j
    for i in range(1, n+1):
        for j in range(1, m+1):
            cost = 0 if ref_tokens[i-1] == hyp_tokens[j-1] else 1
            dp[i][j] = min(
                dp[i-1][j] + 1,      # deletion
                dp[i][j-1] + 1,      # insertion
                dp[i-1][j-1] + cost  # substitution or ok
            )
    # backtrack
    i, j = n, m
    alignment = []
    while i > 0 or j > 0:
        if i>0 and j>0 and dp[i][j] == dp[i-1][j-1] + (0 if ref_tokens[i-1]==hyp_tokens[j-1] else 1):
            if ref_tokens[i-1] == hyp_tokens[j-1]:
                alignment.append({"idx": j-1, "hyp": hyp_tokens[j-1], "ref": ref_tokens[i-1], "op": "ok"})
            else:
                alignment.append({"idx": j-1, "hyp": hyp_tokens[j-1], "ref": ref_tokens[i-1], "op": "sub", "msg": "wrong word"})
            i -= 1; j -= 1
        elif j>0 and dp[i][j] == dp[i][j-1] + 1:
            alignment.append({"idx": j-1, "hyp": hyp_tokens[j-1], "ref": None, "op": "ins", "msg": "extra word"})
            j -= 1
        else:
            alignment.append({"idx": j, "hyp": None, "ref": ref_tokens[i-1], "op": "del", "msg": "missing word"})
            i -= 1
    alignment.reverse()
    return alignment

def wer(ref_tokens, hyp_tokens):
    # compute WER as (S + D + I) / N
    align = levenshtein_alignment(ref_tokens, hyp_tokens)
    s = sum(1 for a in align if a['op']=='sub')
    d = sum(1 for a in align if a['op']=='del')
    i = sum(1 for a in align if a['op']=='ins')
    n = max(1, len(ref_tokens))
    return (s + d + i)/n, align

def score(ref: str, hyp: str):
    rt = tokenize(ref or "")
    ht = tokenize(hyp or "")
    w, align = wer(rt, ht)
    accuracy = max(0, 100 * (1 - w))
    summary = f"Accuracy {round(accuracy)} based on WER {w:.2f}."
    return {"score": accuracy, "summary": summary, "alignment": align}

if __name__ == '__main__':
    raw = sys.stdin.read()
    data = json.loads(raw)
    out = score(data.get('ref', ''), data.get('hyp', ''))
    sys.stdout.write(json.dumps(out))
    sys.stdout.flush()
