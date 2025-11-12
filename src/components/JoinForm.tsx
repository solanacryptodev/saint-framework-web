import { createSignal, Accessor } from "solid-js";

interface JoinFormProps {
  selectedTier: Accessor<string>;
}

export default function JoinForm(props: JoinFormProps) {
  // Form data signals
  const [firstName, setFirstName] = createSignal("");
  const [lastName, setLastName] = createSignal("");
  const [username, setUsername] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [confirmPassword, setConfirmPassword] = createSignal("");
  const [agreedToTerms, setAgreedToTerms] = createSignal(false);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    // Form submission logic will be added later when MongoDB is set up
    console.log({
      firstName: firstName(),
      lastName: lastName(),
      username: username(),
      email: email(),
      password: password(),
      confirmPassword: confirmPassword(),
      agreedToTerms: agreedToTerms(),
      selectedTier: props.selectedTier(),
    });
  };

  return (
    <div class="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
      <h2 class="text-3xl font-bold text-white mb-8 text-center">Create Your Profile</h2>
      
      <form onSubmit={handleSubmit} class="space-y-6">
        {/* First Name and Last Name */}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-white font-semibold mb-2">First Name</label>
            <input
              type="text"
              placeholder="Enter your first name"
              value={firstName()}
              onInput={(e) => setFirstName(e.currentTarget.value)}
              class="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-purple-400 transition-colors"
              required
            />
          </div>
          <div>
            <label class="block text-white font-semibold mb-2">Last Name</label>
            <input
              type="text"
              placeholder="Enter your last name"
              value={lastName()}
              onInput={(e) => setLastName(e.currentTarget.value)}
              class="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-purple-400 transition-colors"
              required
            />
          </div>
        </div>

        {/* Username */}
        <div>
          <label class="block text-white font-semibold mb-2">Username</label>
          <input
            type="text"
            placeholder="Choose a unique username"
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
            class="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-purple-400 transition-colors"
            required
          />
        </div>

        {/* Email Address */}
        <div>
          <label class="block text-white font-semibold mb-2">Email Address</label>
          <input
            type="email"
            placeholder="Enter your email address"
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
            class="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-purple-400 transition-colors"
            required
          />
        </div>

        {/* Password */}
        <div>
          <label class="block text-white font-semibold mb-2">Password</label>
          <input
            type="password"
            placeholder="Create a strong password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
            class="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-purple-400 transition-colors"
            required
          />
        </div>

        {/* Confirm Password */}
        <div>
          <label class="block text-white font-semibold mb-2">Confirm Password</label>
          <input
            type="password"
            placeholder="Confirm your password"
            value={confirmPassword()}
            onInput={(e) => setConfirmPassword(e.currentTarget.value)}
            class="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-purple-400 transition-colors"
            required
          />
        </div>

        {/* Terms and Privacy */}
        <div class="flex items-start gap-3">
          <input
            type="checkbox"
            id="terms"
            checked={agreedToTerms()}
            onChange={(e) => setAgreedToTerms(e.currentTarget.checked)}
            class="mt-1 w-4 h-4 accent-purple-400"
            required
          />
          <label for="terms" class="text-slate-300 text-sm">
            I agree to the{" "}
            <a href="#" class="text-purple-400 hover:text-purple-300 transition-colors">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" class="text-purple-400 hover:text-purple-300 transition-colors">
              Privacy Policy
            </a>
          </label>
        </div>

        {/* Selected Tier Display */}
        <div class="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
          <div class="flex justify-between items-center mb-2">
            <span class="text-white font-semibold">Selected Tier:</span>
            <span class="text-purple-400 font-bold">{props.selectedTier()}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-white font-semibold">Monthly Price:</span>
            <span class="text-white font-bold">
              {props.selectedTier() === "Free Tier" ? "$0" : props.selectedTier() === "Pro Tier" ? "$24.99" : "$49.99"}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          class="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-4 rounded-lg text-lg transition-all duration-300 transform hover:scale-[1.02]"
        >
          Create Account & Start Free
        </button>

        {/* Sign In Link */}
        <p class="text-center text-slate-400">
          Already have an account?{" "}
          <a href="#" class="text-purple-400 hover:text-purple-300 transition-colors">
            Sign in here
          </a>
        </p>
      </form>
    </div>
  );
}
