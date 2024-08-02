import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import plist from 'plist';

enum Language {
    CSS = "Better CSS",
}

enum Extension {
    TmLanguage = "tmLanguage",
    TmTheme = "tmTheme",
    YamlTmLanguage = "YAML-tmLanguage",
    YamlTmTheme = "YAML-tmTheme"
}

function file(language: Language, extension: Extension) {
    return path.join(import.meta.dirname, '..', 'Syntaxes', `${language}.${extension}`);
}

function writePlistFile(grammar: TmGrammar | TmTheme, fileName: string) {
    const text = plist.build(grammar);
    fs.writeFileSync(fileName, text);
}

function readYaml(fileName: string) {
    const text = fs.readFileSync(fileName, "utf8");
    return yaml.load(text);
}

function transformGrammarRule(rule: any, propertyNames: string[], transformProperty: (ruleProperty: string) => string) {
    for (const propertyName of propertyNames) {
        const value = rule[propertyName];
        if (typeof value === 'string') {
            rule[propertyName] = transformProperty(value);
        }
    }

    for (var propertyName in rule) {
        const value = rule[propertyName];
        if (typeof value === 'object') {
            transformGrammarRule(value, propertyNames, transformProperty);
        }
    }
}

function transformGrammarRepository(grammar: TmGrammar, propertyNames: string[], transformProperty: (ruleProperty: string) => string) {
    const repository = grammar.repository;
    for (let key in repository) {
        transformGrammarRule(repository[key], propertyNames, transformProperty);
    }
}

function getCSSGrammar(getVariables: (tsGrammarVariables: MapLike<string>) => MapLike<string>) {
    const cssGrammarBeforeTransformation = readYaml(file(Language.CSS, Extension.YamlTmLanguage)) as TmGrammar;
    return updateGrammarVariables(cssGrammarBeforeTransformation, getVariables(cssGrammarBeforeTransformation.variables as MapLike<string>));
}

function replacePatternVariables(pattern: string, variableReplacers: VariableReplacer[]) {
    let result = pattern;
    for (const [variableName, value] of variableReplacers) {
        result = result.replace(variableName, value);
    }
    return result;
}

type VariableReplacer = [RegExp, string];
function updateGrammarVariables(grammar: TmGrammar, variables: MapLike<string>) {
    delete grammar.variables;
    const variableReplacers: VariableReplacer[] = [];
    for (const variableName in variables) {
        // Replace the pattern with earlier variables
        const pattern = replacePatternVariables(variables[variableName], variableReplacers);
        variableReplacers.push([new RegExp(`{{${variableName}}}`, "gim"), pattern]);
    }
    transformGrammarRepository(
        grammar,
        ["begin", "end", "match"],
        pattern => replacePatternVariables(pattern, variableReplacers)
    );
    return grammar;
}

function buildGrammar() {
    const cssGrammar = getCSSGrammar(grammarVariables => grammarVariables);
    writePlistFile(cssGrammar, file(Language.CSS, Extension.TmLanguage));
}

buildGrammar();
