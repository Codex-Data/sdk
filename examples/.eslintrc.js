module.exports = {
  extends: ["../.eslintrc.js"],
  rules: {
    // Allow console.log in examples
    "no-console": "off",
    // Allow any types in examples for simplicity
    "@typescript-eslint/no-explicit-any": "off",
    // Allow unused vars in examples (for demonstration)
    "@typescript-eslint/no-unused-vars": "warn",
  },
};
