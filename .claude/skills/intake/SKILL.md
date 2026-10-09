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
   - Images: open each photo in `src/assets/client/` and pick the best fit for `business.image` and each
     room. Alt text says what is in the photo ("Canopy bed under a thatched ceiling"), not what you
     hope it sells. A photo that does not show the thing it illustrates gets a TODO, not a stretched alt.
3. Set the production host in `vercel.json`: the X-Robots-Tag rule's `missing` host must be the host of
   `site.url`, so every other host (previews, staging) stays noindex. The build fails if they differ.
4. Write `client/brief.md` from the template's headings. Fill what the notes say. Under **Must not say**,
   add the category risks for this client type (wellness: medical claims; hotels: unverified distances,
   awards, star ratings; F&B: "authentic", sourcing claims) on top of anything the client said.
5. List open questions in `client/QUESTIONS.md`: one line per TODO, written so a project manager can paste
   it into WhatsApp to the client.

## Report back

- Facts filled vs TODO (counts)
- The questions file
- Anything in the notes that contradicts itself (two phone numbers, two check-in times). Do not pick one.
