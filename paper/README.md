# Checkout consent paper

Requires Node 20+, npm, Python 3, Tectonic, and Poppler on PATH.
Run `npm ci`, then `sh paper/template/reproduce.sh` from the repository root.
The output is `paper/checkout-consent-paper.pdf`. PDFs and downloaded styles stay untracked.
The unchanged pilot template downloads and verifies the official NeurIPS preprint style.
Experiments use the public runner, a local mock adapter, and the replay scorer. They make no paid calls.

The plan commit precedes data collection. The source commit is frozen in `config.json`.
The oracle reads expected state. It is a control, not a learned agent.
The extra simulated sweep mixes oracle and unsafe traces, then removes questions in a paired arm.
Its intervals bootstrap whole simulated agents. Control frequencies use Wilson intervals.
Control mean intervals preserve scenario strata and can collapse at constant outcomes.

Raw control reports and repeats are JSON. The larger simulated reports are gzip-compressed JSON.
Generated summaries, figure data, provenance hashes, and replay verification live in `data/`.
The verifier replays every saved row and checks scores, summaries, repeat hashes, and PDF structure.
Timing fields can change across reproduction. Semantic traces and scores must remain identical.
The first study run costs no API fees. Hosted free-model access is not configured or tested.
No human validation, external registration, publication, or merge is included.
Paper and figures: CC-BY-4.0. Benchmark code and tasks: MIT.
