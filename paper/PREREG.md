# Checkout consent study plan

Registered in git before study output. No external registry or deposit is used.
The user forbids publication. This is a local prospective plan, not external registration.

1. Prior knowledge: source inspection and the existing E2E assertions show an oracle ceiling.
No new experiment has run. The honesty pilot supplies only unchanged shared tooling.
2. H1: the oracle achieves full score; empty, constant, echo, refusal, search-only,
and unauthorized-pay scripts achieve zero. H2: a redundant question reduces score.
H3: re-quoting after consent invalidates the old token on payable tasks.
3. Primary outcomes: mean ledger score; full-credit frequency; unauthorized-attempt frequency.
Also report successful payment and correct decline counts. No honesty or calibration metric applies.
Wilson 95% intervals cover binary task outcomes. Scenario-stratified percentile bootstrap
with 2000 draws covers mean score and paired score differences. Boundary intervals can collapse.
The corpus is fixed and synthetic. These intervals do not estimate deployment risk.
4. Frozen source: b12826d0b1539486b2c82dc971b63cd7c1eac7d2, package 0.2.0.
Use all 40 public tasks, seed 20261015, with nine scripts: oracle, empty, constant,
echo, refuse, first-tool, unsafe-pay, extra-ask, stale-quote. The oracle reads expected
state and is an instrument control, not a learned agent. Extra-ask inserts a question
before payment (or after the final question on decline tasks). Stale-quote inserts
get_quote before payment. Run each twice with seed 1, serially, no retries, zero budget,
up to 20 turns and 30 tool calls. Keep complete transcripts; omit timings from repeat hashes.
5. Extra virtual experiment: a SIMULATED population sweep. For each of 40 synthetic
agents (seeds 1..40), independently choose oracle versus unsafe-pay per task using
one seeded uniform draw. Oracle probabilities are 0, .25, .5, .75, 1.
Pair each simulated agent with a control-removal condition that deletes every ask_user
call from its selected trace. Execute both through the public runner and replay grader.
This intervention removes consent acquisition; it does not disable the payment guard.
Use common random numbers across probabilities and arms. Bootstrap whole agent means,
not task episodes, for simulated score, full-credit and unauthorized-attempt rates,
and paired score differences. Label every simulated estimate as simulated.
6. Exclusions: none based on scores. Empty and malformed output remain failures.
Infrastructure errors halt collection and require a logged amendment before rerunning.
No adaptive sample-size change, selection of favorable seeds, or hypothesis tests.
7. Stop after nine repeated controls and the fixed simulated grid finish.
No paid or hosted model request. Free hosted access is not configured for this study;
provider availability is not tested. No human participants, live shop, or real payment.
8. Validation failure modes: replay and runner disagreement; hidden expected-state leakage
mislabelled as model ability; lost unauthorized attempts; row misalignment; duplicate
repeats counted as sample size; task-level intervals applied to simulated agent clusters;
changes to frozen inputs; hand-written result numbers; stale PDF or inconsistent metadata.
Check raw reports against replay, counts against summaries, repeated semantic hashes,
source hashes, template equality, metadata, PDF text, and figure inputs.
Figures: scenario coverage, control scores, simulated sweep, paired simulated ablation.
Report all planned contrasts, including nulls. Paper and figures: CC-BY-4.0; benchmark: MIT.

## Deviations
None at registration.
