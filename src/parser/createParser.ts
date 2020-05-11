import { isPlatformSupported } from '../helper'
import { supportedError } from 'errors'
import windows from 'windows'
import unix from './unix'
import { options, output } from '../types'
import { ERROR_MESSAGES } from '../messages'
import parser from "./parser.interface";

function createParser(platform: string, output?: string[], options?: options): any {
    let parser: any;
    if (isPlatformSupported(platform)) {
        throw new supportedError(ERROR_MESSAGES.PLATFORM_NOT_SUPPORTED.replace('platform', platform));
    }
    if (platform === 'win32') {
        parser = new windows(defaultResponse, options);
    } else if (platform === 'darwin') {
        parser = new unix(options);
    } else {
        parser = new unix(options);
    }
    parseOutput(parser, output);
    return parser;
}

function parseOutput(parser: parser, output?: string[]) {
    let lines = output?.join('').split('\n');
    let state = 0;
    let parsedOutput: output = defaultResponse;
    lines?.forEach((line) => {
        line = line.replace(stripRegex, '');
        if (line.length === 0) {
            // Do nothing if this is an empty line
        } else if (state === states.HEADER) {
            parser.processHeader(line);
            state = states.BODY
        } else if (state === states.BODY) {
            (!checkIfBodyEnded(line)) ? parser.processBody(line) : state = states.FOOTER
        } else if (state === states.FOOTER) {
            parsedOutput = parser.processFooter(line);
            state = states.END
        } else if (state === states.END) {
            //do - nothing
        }
    })
    let result = createResult(parsedOutput, lines);
    return result;
}

function checkIfBodyEnded(line: string): boolean {
    let isPingSummaryLineShown = line.slice(-1) === ':';
    if (isPingSummaryLineShown) {
        return true;
    }
    return false;
}

function createResult(result: output, lines?: Array<string>) {
    // Concat output
    result.output = lines?.join('\n');

    // Determine alive
    result.alive = result?.times?.length > 0;

    // Update time at first successful line
    if (result.alive) {
        result.time = result.times[0];
    }

    // Get stddev
    if (result.stddev === undefined && result.alive) {
        let N = result.times.length;
        const mean = result.times.reduce((a, b) => a + b) / N;
        const stddev = Math.sqrt(result.times.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / N);
        result.stddev = stddev.toString();
    }

    // Fix min, avg, max, stddev up to 3 decimal points
    ['min', 'avg', 'max', 'stddev', 'packetLoss'].forEach((key) => {
        var v = (result as any)[key];
        if (typeof v === 'number') {
            (result as any)[key] = v.toFixed(3);
        }
    });

    return result;
}

const defaultResponse: output = {
    host: undefined,
    numericHost: undefined,
    alive: false,
    output: undefined,
    time: undefined,
    times: [],
    min: undefined,
    max: undefined,
    avg: undefined,
    stddev: undefined,
    packetLoss: undefined,
    bufferSize: undefined
};

const stripRegex: RegExp = /[ ]*\r?\n?$/g;

const states = {
    HEADER: 0,
    BODY: 1,
    FOOTER: 2,
    END: 3,
};

export default createParser;
