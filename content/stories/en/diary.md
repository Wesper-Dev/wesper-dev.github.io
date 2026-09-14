# Diary / Kura — following a recording through the system

A voice journal, from the browser to weekly reports.

## Two hackathons, then a continuation

Kura is a team audio-journal project developed at the Google Cloud Partner Agentic AI Hackathon and then the One-Person Unicorn Vibe-a-thon at STATION F. Diary is my personal continuation: developing the path between recording, audio processing, storage and reports.

## Connecting the steps

The React and TypeScript interface records voice with MediaRecorder in WebM/Opus format. A FastAPI backend receives the files; FFmpeg converts them to mono WAV at 16 kHz. Google Cloud Storage then organises recordings by user and week.

The work presented here concerns that integration: passing consistent data between components, from the format produced by the browser to the one needed for processing, and then retrieving recordings in reports.

## An explicit analysis choice

The prototype sends the analysis choice to the backend through a conditional opt-in header. Weekly reports support HTML export. The repository documents startup with Docker Compose and an ARM64 build procedure for Raspberry Pi 4.

## Result and limitations

Diary remains a proof of concept with cloud storage. The documentation distinguishes mocked data from real processing; local identity handling is for demonstration. Opt-in does not establish compliance, and the reports are not clinically validated. The Raspberry Pi procedure documents a deployment path, without claiming a benchmark or continuous operation.

## Links and credits

- [Diary repository and setup instructions](https://github.com/Wesper-Dev/Diary)

Kura was built as a team; Diary continues a personal part of that work.
