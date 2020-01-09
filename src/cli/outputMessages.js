import path from 'path';
import chalk from 'chalk';

import {
  outputLightBlue,
  outputBgRed,
  outputGrey,
  outputBgYellow,
  outputRed,
  outputBgLightBlue,
  outputYellow,
  outputUnderline,
} from '../utils';

import { messageLevels } from '../error/default';

import { groupByFiles, groupErrors } from './groupMessages';

const colorizeMessageHeader = (msg, longestPath) => {
  const msgHeader = `${path.relative(process.cwd(), msg.file)}:${msg.location.startLine}:${msg.location.startCol}`;
  switch (msg.severity) {
    case messageLevels.ERROR:
      return outputBgRed(outputBgRed(msgHeader.padEnd(longestPath + 2 - 20)));
    case messageLevels.WARNING:
      return outputBgYellow(outputRed(msgHeader.padEnd(longestPath + 2 - 20)));
    case messageLevels.INFO:
      return outputBgLightBlue(outputRed(msgHeader.padEnd(longestPath + 2 - 20)));
    default:
      return msgHeader;
  }
};

const colorizeRuleName = (error, severity) => {
  switch (severity) {
    case messageLevels.ERROR:
      return outputRed(error);
    case messageLevels.WARNING:
      return outputYellow(error);
    case messageLevels.INFO:
      return outputBgLightBlue(error);
    default:
      return error;
  }
};


const pathImproveReadability = (msgPath) => msgPath.map((el) => (el[0] === '/' ? outputGrey('[\'') + outputLightBlue(el) + outputGrey('\']') : outputGrey(el)));
const prettifyReferencedFrom = (row) => `${outputLightBlue(`${row.file}:${row.startLine}`)} ${outputGrey(`#/${pathImproveReadability(row.path).join(outputGrey('/'))}`)}`;

const renderReferencedFrom = (referencedFromPlaces, severity) => {
  if (referencedFromPlaces.length === 0) return '';
  return `This ${severity.toLowerCase()} is referenced from:\n${referencedFromPlaces.map((row, id) => `${id + 1}) ${prettifyReferencedFrom(row)}`).join('\n')}`;
};

const getMsgSeverity = (msg) => {
  switch (msg.severity) {
    case messageLevels.WARNING:
      return 'Warning';
    case messageLevels.ERROR:
    default:
      return 'Error';
  }
};

export const prettyPrint = (i, error) => {
  const { possibleAlternate } = error;
  const message = `[${i}] ${colorizeMessageHeader(error)} ${outputGrey(`at #/${outputGrey(pathImproveReadability(error.path).join(outputGrey('/')))}`)}`
  + `\n${error.message}\n`
  + `${possibleAlternate && possibleAlternate.possibleAlternate ? `\nDid you mean: ${outputLightBlue(possibleAlternate.possibleAlternate)} ?\n` : ''}`
  + `${error.enableCodeframe ? `\n${error.codeFrame}\n\n` : ''}`
  + `${getMsgSeverity(error)} was generated by ${chalk.red(error.fromRule)} rule.\n\n`
  + `${renderReferencedFrom(error.referencedFromPlaces, getMsgSeverity(error))}`
  + '\n\n';
  return message;
};

export const printValidationHeader = (_filePath) => {
  // nope for now [Roman]
  // well, at least I've tried. Not a designer, for sure [Sergey]
};

export const prettyPrintShort = (i, error, longestPath, longestRuleName) => {
  const message = `${(`${error.location.startLine}:${error.location.startCol}`).padEnd(longestPath)} ${colorizeRuleName(error.fromRule.padEnd(longestRuleName + 2), error.severity)} ${error.message}\n`;
  return message;
};

export const outputMessages = (result, cmdObj) => {
  const errorsGrouped = groupErrors(result);
  const groupedByFile = groupByFiles(errorsGrouped);

  const totalErrors = errorsGrouped.filter(
    (msg) => msg.severity === messageLevels.ERROR,
  ).length;
  const totalWarnings = errorsGrouped.filter(
    (msg) => msg.severity === messageLevels.WARNING,
  ).length;

  if (cmdObj.short && errorsGrouped.length !== 0) {
    const posLength = errorsGrouped
      .map((msg) => `${msg.location.startLine}:${msg.location.startCol}`)
      .sort((e, o) => e.length > o.length)
      .pop()
      .length;

    const longestRuleName = errorsGrouped
      .map((msg) => msg.fromRule)
      .sort((e, o) => e.length > o.length)
      .pop()
      .length;

    Object.keys(groupedByFile).forEach((fileName) => {
      process.stderr.write(`${outputUnderline(`${path.relative(process.cwd(), fileName)}:\n`)}`);
      groupedByFile[fileName]
        .sort((a, b) => a.severity < b.severity)
        .forEach(
          (entry, id) => process.stderr.write(
            prettyPrintShort(id + 1, entry, posLength, longestRuleName),
          ),
        );
      process.stderr.write('\n');
    });
  } else {
    if (errorsGrouped.length > 0) process.stderr.write('\n\n');
    errorsGrouped
      .sort((a, b) => a.severity < b.severity)
      .forEach((entry, id) => process.stderr.write(prettyPrint(id + 1, entry)));
  }

  return {
    totalErrors,
    totalWarnings,
  };
};
