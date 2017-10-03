(process.env.SFDX_EXPERIMENTS || '')
    .split(',')
    .map((s) => s.trim())
    .forEach((experiment) => require('./' + experiment));
