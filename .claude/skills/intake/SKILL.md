---
description: Turn a client's raw notes (email, WhatsApp export, call notes, old website text) into client/facts.yaml and client/brief.md, marking every unknown as TODO instead of guessing.
argument-hint: <path to notes file(s)>
disable-model-invocation: true
---

# /intake

Turn the client material in `$ARGUMENTS` into the two brief files. This is the first step for every new
client, and the step where a wrong guess costs the most: everything downstream trusts these files.

## Steps

1. Read every file in `$ARGUMENTS`. Read `client/facts.yaml` and `src/lib/facts.ts` for the schema.
2. Write `client/facts.yaml` for this client, keeping the comment header.
   - Copy values exactly as the client wrote them. Convert format only (24h times, whole-number prices,
     E.164-style phone with spaces, ISO country code).
   - A value the notes do not state is `TODO`, even when you could guess it. A guess here becomes a
     published fact. Required fields that are TODO keep the build failing on purpose.
   - Do not fill `geo` from your own knowledge of the area. Use coordinates the client gave, or TODO.
   - Treatment and menu descriptions: the client's words, shortened if needed, never improved with
     benefits they did not claim.
3. Write `client/brief.md` from the template's headings. Fill what the notes say. Under **Must not say**,
   add the category risks for this client type (wellness: medical claims; hotels: unverified distances,
   awards, star ratings; F&B: "authentic", sourcing claims) on top of anything the client said.
4. List open questions in `client/QUESTIONS.md`: one line per TODO, written so a project manager can paste
   it into WhatsApp to the client.

## Report back

- Facts filled vs TODO (counts)
- The questions file
- Anything in the notes that contradicts itself (two phone numbers, two check-in times). Do not pick one.
