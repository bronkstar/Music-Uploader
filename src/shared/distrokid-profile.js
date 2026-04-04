const DISTROKID_UPLOAD_PROFILE = {
  fixedRules: {
    mapTrackTitlesByWaveOrder: true,
    setInstrumentalForEveryTrack: true,
    enableAppleMusicCreditsForEverySong: true,
    keepExtrasUnchecked: true,
    requireTotalPriceZeroEuro: true,
    selectRequiredFieldsOnly: true,
  },
  credits: [
    {
      role: "Synthesizer",
      name: "Björn Richter",
    },
    {
      role: "Co-executive Producer",
      name: "Björn Richter",
    },
  ],
};

module.exports = {
  DISTROKID_UPLOAD_PROFILE,
};
