# plans/README.md: the plans, in the order they're done

Each plan is done, checked and committed before the next one starts. A plan's own file says
what it changes; this list is the only place that says when.

1. `void-1.9.md`: Void 1.8.0 to 1.9.1, so nothing is built twice.
2. `fbtee-fully.md`: use all of fbtee that fits, before building on top of it.
3. `their-own-language.md`: every visitor lands in their own language (the front-door bug).
4. `primitives.md`: void-fbtee's missing primitives, moved out of the example into the package.
5. `use-cases.md`: one event, many people, as data, built on the primitives.
6. `video-conferencing.md`: `void-moq`, built on all of the above.

Waiting on others, not in the order:

- `void-form-without-javascript.md`: waits on Void (an issue drafted for voidzero-dev/void, filed
  only with the user's OK).
- `quiet-harbor-atlas.md`: the long plan, steps 1–8 done. Steps 9 (sign-in) and 10 (API routes with
  a language) wait until the example needs them, and "Still open" has the preview-AI note, the
  user's call.

A plan that's finished is deleted; git keeps it.
