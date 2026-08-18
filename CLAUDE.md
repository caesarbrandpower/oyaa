@AGENTS.md

## Deploy-workflow — altijd volgen, nooit overslaan

Na elke fix die getest moet worden:

1. Push de feature-branch naar remote (`git push origin <branch>`).
2. Merge naar de staging-branch en push staging.
3. Bevestig welke commit-hash nu op staging staat.

Pas daarna melden dat de fix klaar is om te testen.

**Waarom:** Als stap 2-3 worden overgeslagen, test de gebruiker op de vorige versie. Dat heeft vier keer op rij tot verwarring geleid waarbij fixes als "niet werkend" werden afgedaan terwijl ze lokaal correct waren.
