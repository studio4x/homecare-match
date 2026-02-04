export const translateAuthError = (errorMessage: string): string => {
  const error = errorMessage.toLowerCase();

  if (error.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (error.includes("user already registered")) return "Este e-mail já está cadastrado.";
  if (error.includes("email not confirmed")) return "Verifique seu e-mail para confirmar o cadastro.";
  if (error.includes("password should be at least")) return "A senha deve ter pelo menos 6 caracteres.";
  if (error.includes("rate limit exceeded")) return "Muitas tentativas. Aguarde um momento.";
  if (error.includes("user not found")) return "Usuário não encontrado.";
  if (error.includes("weak password")) return "A senha é muito fraca.";
  if (error.includes("invalid email")) return "Formato de e-mail inválido.";
  if (error.includes("missing email")) return "O e-mail é obrigatório.";
  if (error.includes("missing password")) return "A senha é obrigatória.";
  
  // Erros genéricos ou do servidor
  if (error.includes("database error")) return "Erro de conexão com o banco de dados.";
  if (error.includes("fetch failed")) return "Falha na conexão. Verifique sua internet.";
  
  // Retorno padrão se não houver tradução específica, mas mantendo amigável
  return errorMessage || "Ocorreu um erro inesperado. Tente novamente.";
};