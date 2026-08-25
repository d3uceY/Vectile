$ErrorActionPreference = 'Stop'
$dir = Join-Path $PSScriptRoot 'text documents'
$allFiles = Get-ChildItem $dir -Filter '*.txt' | Sort-Object Name
$corpus = ''
foreach ($f in $allFiles) { $corpus += (Get-Content $f.FullName -Raw).ToLower() + ' ' }

# candidate: query -> target file -> designated absent keyword
$cands = @(
  @{q='homemade spaghetti sauce from ripe tomatoes';      t='01-italian-sunday-sauce.txt'; kw='spaghetti'},
  @{q='turning ripe bananas into muffins';                t='02-banana-bread.txt';         kw='muffin'},
  @{q='natural yeast that makes bread tangy';             t='03-sourdough-starter.txt';    kw='yeast'},
  @{q='cozy autumn chowder with beans';                   t='04-fall-vegetable-soup.txt';  kw='chowder'},
  @{q='HIIT sessions to raise your stamina';              t='05-morning-intervals.txt';    kw='hiit'},
  @{q='marathon fuel and hydration plan';                 t='06-long-run-prep.txt';        kw='marathon'},
  @{q='mountain trail with sweeping views';               t='07-weekend-hike.txt';         kw='mountain'},
  @{q='airport carry-on essentials checklist';            t='08-flight-packing.txt';       kw='airport'},
  @{q='overnight camping kit that stays light';           t='09-backpacking-gear.txt';     kw='camping'},
  @{q='fresh salsa straight from the pots';               t='10-container-tomatoes.txt';   kw='salsa'},
  @{q='vegan protein sources for athletes';               t='11-plant-protein.txt';        kw='vegan'},
  @{q='evening wind-down ritual for deep rest';           t='12-sleep-hygiene.txt';        kw='ritual'},
  @{q='office posture tips for long days at a screen';    t='13-ergonomic-desk.txt';       kw='posture'},
  @{q='version control for a one-person project';         t='14-git-solo.txt';             kw='version'},
  @{q='systems language for terminal tools';              t='15-rust-cli.txt';             kw='terminal'},
  @{q='dystopian novels about what comes next';           t='16-sci-fi-reading-list.txt';  kw='dystopian'},
  @{q='cartoon marathon for family night';                t='17-animated-movie-night.txt'; kw='cartoon'}
)

$fail = 0
foreach ($c in $cands) {
  $file = Join-Path $dir $c.t
  $re = '(?i)\b' + [regex]::Escape($c.kw) + '\b'
  $inTarget = [regex]::IsMatch((Get-Content $file -Raw), $re)
  $inCorpus  = [regex]::IsMatch($corpus, $re)
  if ($inTarget -or $inCorpus) { $fail++ }
  $status = if ($inTarget -or $inCorpus) { 'FAIL' } else { 'OK' }
  Write-Output ("{0}  {1,-12}  {2}" -f $status, $c.kw, $c.t)
}
Write-Output ""
if ($fail -eq 0) {
  Write-Output "PASS: all $($cands.Count) missing keywords are absent from their target AND the whole corpus."
} else {
  Write-Output "FAIL: $fail keyword(s) found - see rows above."
}
