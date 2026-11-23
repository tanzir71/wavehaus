# Organiser ground truth

`organise-cases.ts` contains 73 manually labelled metadata cases. These are
independent examples, with expected values written before running the rules.
They cover each filename pattern, tags overriding folder guesses, missing/junk
tags, nested CD/disc folders, combined artist/album/year folders, Windows paths,
copy/download noise, meaningful featuring/remix text, Unicode, mixed case,
acronyms, roman numerals and phone recordings.

`tests/unit/organise.test.ts` checks each case against those labels. Its batch
checks additionally cover compilations, distinct artist folders, uploader-owned
album matching, per-disc numbering, input immutability and individual rules.

The tiny original audio in `library/` exercises actual tag parsing and import
through the browser tests. The metadata fixture cases do not duplicate audio
bytes or claim to represent an external music corpus.
