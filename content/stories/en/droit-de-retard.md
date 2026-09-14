# Droit de Retard — keeping decisions explicit

A local-first prototype that prepares a draft flight-compensation claim from travel documents.

## The problem

A ticket does not tell the whole story of a disrupted journey. Useful facts need to be extracted, missing information requested, and the evidence examined for what it actually establishes. This project explores that sequence: read a document, assemble a case and prepare a response, while keeping the software’s intermediate steps visible.

## A team idea, followed by a personal continuation

Droit de Retard continues a project developed as a team at the Paris Gemma 4 Hackathon. The original repository and submission video document that collective work. The version presented here is my personal continuation, focused on tool-call validation, regression tests and continuous-integration checks.

## What the model does, what the code does

Gemma helps read the document and draft the response. Qualification rules and calculations remain in Python. For tool use, the program maintains an allow-list and recomputes the expected arguments before accepting a request from the model. Missing or rejected calls can trigger an explicit fallback path.

Source retrieval and network availability are also accounted for. The trace exposes the steps and any degraded modes. “Local-first” describes an architecture centred on local execution; it does not mean that every feature ignores the network, since source retrieval can use it.

## Checking a concrete scope

Regression tests make the expected behaviours inspectable. The repository includes evaluation documentation, reproduction commands and example outputs. I link to that versioned evaluation instead of freezing a test count in this story: the scope can change alongside the code.

## Where the project stands

This is an informational prototype, not a passenger-representation service. A generated letter does not guarantee compensation. The screenshot shows a demonstration interface; it is neither a performance measurement nor evidence of a production deployment.

The project connects my interest in AI with my systems foundation: making transitions, validation and errors explicit enough to examine. The public repository is the place to inspect those choices, reproduce the documented checks and see what still needs work.

## Links and credits

- [Personal repository](https://github.com/Wesper-Dev/droit-de-retard)
- [Original team project](https://github.com/Claken/Paris-Gemma-4-Hackaton)
- [Documented evaluation](https://github.com/Wesper-Dev/droit-de-retard/blob/main/docs/EVALUATION.md)
- [Team video](https://www.youtube.com/watch?v=tOn7xXNZ6s0)

The repository preserves the history of collective work and contributions assisted by AI tools.
